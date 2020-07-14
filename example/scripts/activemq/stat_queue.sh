#!/bin/bash
cmd="/var/lib/artemis/bin/artemis"
user=artemis
password=simetraehcapa
type=robot
id=robot01

docker exec -t example_activemq_1 \
  ${cmd} queue stat --user ${user} --password ${password} \
  --queueName ${type}.${id}
