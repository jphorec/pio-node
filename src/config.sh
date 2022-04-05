#!/bin/bash -xe
set -e

while getopts p:v:g:c:m flag
do
    case "${flag}" in
        p) prov-url=${OPTARG};;
        v) chain-version=${OPTARG};;
        g) go-version=${OPTARG};;
        c) chain-id=${OPTARG};;
        m) moniker=${OPTARG};;
    esac
done

GO_VERSION="${go-version:-go1.18.linux-amd64}"
# currently defaulting to my own fork of provenance, will update once forked changes are on the latest version
DEFAULT_PROV_VERSION=$(curl -s https://api.github.com/repos/provenance-io/provenance/releases/latest | grep zipball_url | cut -d '"' -f 4)

PROV_URL="${prov-url:-$DEFAULT_PROV_VERSION}"
CHAIN_VERSION="${chain-version:-testnet}"
CHAIN_ID="${chain-id:-pio-testnet-1}"
MONIKER="${moniker:-cdk-generated-node}"
# Update with optional user data that will run on instance start.
# Learn more about user-data: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/user-data.html

mkdir /home/pio
export PIO_HOME=/home/pio

# Install golang
wget https://go.dev/dl/"$GO_VERSION".tar.gz
tar -C /usr/local -xzf "$GO_VERSION".tar.gz

# echo "export PATH=$PATH:/usr/local/go/bin" >> /etc/profile 

# prepare tools for building leveldb
yum groupinstall 'Development Tools'
yum install libsnappy-devel -y

# Install level-db
echo "Installing leveldb..."
wget "https://github.com/google/leveldb/archive/v1.20.tar.gz" -P /tmp
tar xvf /tmp/v1.20.tar.gz -C /tmp
cd /tmp/leveldb-1.20
make && sudo scp -r out-static/lib* out-shared/lib* "/usr/local/lib"
cd include && sudo scp -r leveldb /usr/local/include
cd /usr/local/lib
sudo ln -s libleveldb.so.1.20 libleveldb.so.1d
sudo ldconfig

wget -O provenance.zip $PROV_URL
unzip provenance.zip
cd provenance
make clean 
make install

provenanced init $MONIKER --"$CHAIN_VERSION"

curl https://raw.githubusercontent.com/provenance-io/"$CHAIN_VERSION"/main/"$CHAIN_ID"/genesis.json > genesis.json
mv gensis.json $PIO_HOME/config

curl https://raw.githubusercontent.com/provenance-io/"$CHAIN_VERSION"/main/"$CHAIN_ID"/config.toml > config.toml
mv config.toml $PIO_HOME/config

go get github.com/provenance-io/cosmovisor/cmd/cosmovisor

echo 'export DAEMON_NAME="provenanced"' >> /etc/profile
echo 'export DAEMON_HOME="${PIO_HOME}"' >> /etc/profile
echo 'export DAEMON_ALLOW_DOWNLOAD_BINARIES="true"' >> /etc/profile
echo 'export DAEMON_RESTART_AFTER_UPGRADE="true"' >> /etc/profile

mkdir -p $PIO_HOME/cosmovisor/genesis/bin
mkdir -p $PIO_HOME/cosmovisor/upgrades
ln -sf $PIO_HOME/cosmovisor/genesis/bin $PIO_HOME/cosmovisor/genesis/current

cp $(which provenanced) $PIO_HOME/cosmovisor/genesis/bin 
ln -sf $PIO_HOME/cosmovisor/genesis/bin/provenanced $(which provenanced)

cosmovisor start --"$CHAIN_VERSION" --home $PIO_HOME --p2p.seeds 2de841ce706e9b8cdff9af4f137e52a4de0a85b2@104.196.26.176:26656,add1d50d00c8ff79a6f7b9873cc0d9d20622614e@34.71.242.51:26656 --x-crisis-skip-assert-invariants


