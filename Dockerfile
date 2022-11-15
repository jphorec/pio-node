FROM amd64/fedora

ADD src/config.sh config.sh

RUN chmod 777 config.sh

#RUN sed 's/\r$//' config.sh > config.sh

ENV MONIKER=local-node 
ENV PROV_URL=https://github.com/provenance-io/provenance/archive/refs/tags/v1.12.1.zip
ENV CHAIN_ID=pio-mainnet-1
ENV CHAIN_VERSION=mainnet
ENV GO_VERSION=go1.18.linux-amd64
ENV PIO_HOME=/home/pio

RUN /config.sh

