#!/usr/bin/env bash

set -o allexport
. $PWD/local.env
set +o allexport

mosquitto_passwd -b -c /etc/mosquitto/passwd $MQTT_USERNAME $MQTT_PASSWORD
echo -e "allow_anonymous false
password_file /etc/mosquitto/passwd
listener 1883" > /etc/mosquitto/conf.d/default.conf

mkdir -p /.data/mongodb
docker kill $(docker ps -aq)
docker container rm $(docker container ls -aq)
docker run --name playnite-web-db -d \
  --network host \
  -e MONGO_INITDB_ROOT_USERNAME=$MONGO_INITDB_ROOT_USERNAME \
  -e MONGO_INITDB_ROOT_PASSWORD=$MONGO_INITDB_ROOT_PASSWORD \
  -v /.data/mongodb:/data/db \
  mongo:7.0.3-jammy

mosquitto -c /etc/mosquitto/conf.d/default.conf --daemon --verbose
