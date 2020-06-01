#!/bin/bash
cmd="/var/lib/artemis/bin/artemis"
user=artemis
password=simetraehcapa
type=robot
id=robot01

suffixes=("up" "down")
for suf in "${suffixes[@]}"; do
  docker exec -t example_activemq_1 \
    ${cmd} queue create --user ${user} --password ${password} \
    --name ${type}.${id}.${suf} --address ${type}.${id}.${suf} \
    --anycast --no-durable --preserve-on-no-consumers --auto-create-address
done
