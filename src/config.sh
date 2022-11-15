#!/bin/bash -xe

# Update with optional user data that will run on instance start.
# Learn more about user-data: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/user-data.html

set -e

sudo dnf install wget which iptables -y

echo "building with the following parameters: $CHAIN_VERSION $CHAIN_ID $MONIKER $GO_VERSION $PROV_URL"

mkdir $PIO_HOME
export PIO_HOME=$PIO_HOME
echo "export PIO_HOME=$PIO_HOME" >> /etc/environment

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
sudo dnf makecache --refresh
sudo dnf -y install leveldb
sudo dnf -y install leveldb-devel
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

provenanced init $MONIKER --chain-id $CHAIN_ID

curl https://raw.githubusercontent.com/provenance-io/"$CHAIN_VERSION"/main/"$CHAIN_ID"/genesis.json > genesis.json
mv -f genesis.json $PIO_HOME/config

# curl https://raw.githubusercontent.com/provenance-io/"$CHAIN_VERSION"/main/"$CHAIN_ID"/config.toml > config.toml
# mv -f config.toml $PIO_HOME/config

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

rm -rf $PIO_HOME/data

# Start chain with provenanced as background process 
# provenanced start --home $PIO_HOME --p2p.seeds 2de841ce706e9b8cdff9af4f137e52a4de0a85b2@104.196.26.176:26656,add1d50d00c8ff79a6f7b9873cc0d9d20622614e@34.71.242.51:26656 --x-crisis-skip-assert-invariants &