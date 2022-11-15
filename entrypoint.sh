#!/bin/bash -xe
SNAPSHOT_URL=https://storage.googleapis.com/storage/v1/b/provenance-"$CHAIN_VERSION"-backups/o/latest-data-indexed.tar.gz?alt=media

source /etc/environment

if [ ! -d "/home/pio/data" ]
then 
    echo "data directory does not exist, creating..."      
    cd /home/pio
    # Download latest snapshot from provenance quicksync
    wget -c $SNAPSHOT_URL -O - | tar -xz
fi

# Open the rpc port to external connections
# iptables -t nat -I PREROUTING -p tcp -d 0.0.0.0/0 --dport 26657 -j DNAT --to-destination 127.0.0.1:26657 --cap-add=NET_ADMIN
# sysctl -w net.ipv4.conf.eth0.route_localnet=1

cosmovisor start --home /home/pio --p2p.seeds 4bd2fb0ae5a123f1db325960836004f980ee09b4@seed-0.provenance.io:26656, 048b991204d7aac7209229cbe457f622eed96e5d@seed-1.provenance.io:26656 --x-crisis-skip-assert-invariants