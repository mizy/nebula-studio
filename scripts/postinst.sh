#!/bin/bash

# will exec when studio rpm installed
cd /usr/local/nebula-graph-studio/
chmod 755 ./vendors/nebula-importer
chmod 755 ./vendors/nebula-http-gateway/nebula-http-gateway
chmod 777 ./tmp/
tar -xzvf node_modules.tar.gz

bash ./scripts/start.sh
