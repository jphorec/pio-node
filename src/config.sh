#!/bin/bash -xe

# Update with optional user data that will run on instance start.
# Learn more about user-data: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/user-data.html

set -e

SNAPSHOT_URL=https://storage.googleapis.com/storage/v1/b/provenance-testnet-backups/o/latest-data.tar.gz?alt=media

GO_VERSION=go1.18.linux-amd64
# Default to latest release of the chain
PROV_URL=$(curl -s https://api.github.com/repos/provenance-io/provenance/releases/latest | grep zipball_url | cut -d '"' -f 4)
CHAIN_VERSION=testnet
CHAIN_ID=pio-testnet-1
MONIKER=cdk-generated-node

while getopts ":p:v:g:c:m:" options; do
    case "${options}" in
        p) PROV_URL=${OPTARG};;
        v) CHAIN_VERSION=${OPTARG};;
        g) GO_VERSION=${OPTARG};;
        c) CHAIN_ID=${OPTARG};;
        m) MONIKER=${OPTARG};;
    esac
done


echo "building with the following parameters: $CHAIN_VERSION $CHAIN_ID $MONIKER $GO_VERSION $PROV_URL"

mkdir /home/pio
export PIO_HOME=/home/pio
echo "export PIO_HOME=/home/pio" >> /etc/environment


cd /home/pio
# Download latest snapshot from provenance quicksync
wget -c $SNAPSHOT_URL -O - | tar -xz

cd /
# Install golang
echo "Installing go..."
wget https://go.dev/dl/"$GO_VERSION".tar.gz
tar -C /usr/local -xzf "$GO_VERSION".tar.gz


mkdir /go
export GOPATH=/go
export PATH=$PATH:$GOPATH/bin

echo "GOPATH=/go" >> /etc/environment

# prepare tools for building leveldb
yum groupinstall 'Development Tools' -y
yum install snappy-devel -y 

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

export LD_LIBRARY_PATH=/usr/local/lib

echo "export LD_LIBRARY_PATH=/usr/local/lib" >> /etc/environment
echo "export PATH=$PATH:$GOPATH/bin:/usr/local/go/bin:/usr/local/lib" >> /etc/environment

source /etc/environment

export HOME=/root

# Install provenanced
cd /
echo "Installing provenance..."
wget -O provenance.zip $PROV_URL
unzip provenance.zip
rm provenance.zip
mv provenance* provenance
cd provenance
make clean 
make install

provenanced init $MONIKER --"$CHAIN_VERSION"

curl https://raw.githubusercontent.com/provenance-io/"$CHAIN_VERSION"/main/"$CHAIN_ID"/genesis.json > genesis.json
mv genesis.json $PIO_HOME/config

curl https://raw.githubusercontent.com/provenance-io/"$CHAIN_VERSION"/main/"$CHAIN_ID"/config.toml > config.toml
mv config.toml $PIO_HOME/config

# Install cosmovisor
echo "Installing cosmovisor..."
go install github.com/provenance-io/cosmovisor/cmd/cosmovisor@latest

echo 'export DAEMON_NAME="provenanced"' >> /etc/environment
echo 'export DAEMON_HOME="${PIO_HOME}"' >> /etc/environment
echo 'export DAEMON_ALLOW_DOWNLOAD_BINARIES="true"' >> /etc/environment
echo 'export DAEMON_RESTART_AFTER_UPGRADE="true"' >> /etc/environment

source /etc/environment 

mkdir -p $PIO_HOME/cosmovisor/genesis/bin
mkdir -p $PIO_HOME/cosmovisor/upgrades
ln -sf $PIO_HOME/cosmovisor/genesis/bin $PIO_HOME/cosmovisor/genesis/current

cp $(which provenanced) $PIO_HOME/cosmovisor/genesis/bin 
ln -sf $PIO_HOME/cosmovisor/genesis/bin/provenanced $(which provenanced)

# Start chain with provenanced as background process 
echo "Strating provenance..."
# cosmovisor start --"$CHAIN_VERSION" --home $PIO_HOME --p2p.seeds 2de841ce706e9b8cdff9af4f137e52a4de0a85b2@104.196.26.176:26656,add1d50d00c8ff79a6f7b9873cc0d9d20622614e@34.71.242.51:26656 --x-crisis-skip-assert-invariants
provenanced start --"$CHAIN_VERSION" --home $PIO_HOME --p2p.seeds 2de841ce706e9b8cdff9af4f137e52a4de0a85b2@104.196.26.176:26656,add1d50d00c8ff79a6f7b9873cc0d9d20622614e@34.71.242.51:26656 --x-crisis-skip-assert-invariants &