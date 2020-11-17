# amqp10-converter
A protocol converter for AMQP 1.0 and FIWARE IoT Agent JSON or AMQP 1.0 and FIWARE Orion.

[![Docker badge](https://img.shields.io/docker/pulls/roboticbase/amqp10-converter.svg)](https://hub.docker.com/r/roboticbase/amqp10-converter/)
[![TravisCI Status](https://travis-ci.org/RoboticBase/amqp10-converter.svg?branch=master)](https://travis-ci.org/RoboticBase/amqp10-converter/)

## Description
This converter is designed to be a bridge between [AMQP 1.0](http://www.amqp.org/sites/amqp.org/files/amqp.pdf) and [FIWARE IoTAgent JSON](https://github.com/telefonicaid/iotagent-json). Also supported bridge between [AMQP 1.0](http://www.amqp.org/sites/amqp.org/files/amqp.pdf) and [FIWARE Orion](https://github.com/telefonicaid/fiware-orion). This converter has been confirmed to be able to connect with the following Cloud-Managed Services or OSS:
* [Microsoft Azure ServiceBus](https://azure.microsoft.com/en-us/services/service-bus/)
* [AWS Amazon MQ](https://aws.amazon.com/amazon-mq/)
* [Apache ActiveMQ classic](http://activemq.apache.org/components/classic/) 5.15.9
* [Apache ActiveMQ Artemis](http://activemq.apache.org/components/artemis/) 2.13.0

This converter is based on the [FIWARE IoTAgent JSON](https://github.com/telefonicaid/iotagent-json) and the [IoT Agent Node.js Library](https://github.com/telefonicaid/iotagent-node-lib). Further general information about the FIWARE IoT Agents framework, its architecture and the common interaction model can be found in their GitHub repositories.

## Background
In the Cloud-Native Era, the Cloud-Managed Services have become more useful, more powerful and more desiaalbe. But unfortunately, Cloud-Managed Message Queue Service such as [Microsoft Azure ServiceBus](https://azure.microsoft.com/en-us/services/service-bus/) or [AWS Amazon MQ](https://aws.amazon.com/amazon-mq/) can not handle AMQP 0.9.1 supported by FIWARE IoT Agent.  
Therefore this converter was developed to bridge bewteen Cloud-Managed Message Queue Service and FIWARE IoTAgent using AMQP 1.0.

An example is available to try this converter using docker-compose. Please see [example/README.md](example/README.md).

## CAUTION
* Unlike FIWARE IotAgent, **this converter cannot create required Queues corresponding to device Entities automatically** because AMQP 1.0 does not define the APIs for manage Queues. Therefore you have to create the required Queues by yourself **before** starting this converter.
* The environment variables of current version (0.3.0) has **lost the backward compatibility** to 0.2.0. Please update your environment if you use 0.2.0.

## Naming and Formatting
### Endpoint
When you use iotagent backend, The endpoint listening the POST request from IoTAgent JSON is like this: `http://<host>:<port>/<basePath>/cmd/<entityType>/<entityId>`.

The default value of `<basePath>` is "/amqp10", but you can change this by using `BASE_PATH` environment variable if you want.

When you use orion backend, The endpoint listening the POST request from Orion is like this: `http://<host>:<port>/<ngsiVersion>/entities` and the PATCH request from Orion is like this: `http://<host>:<port>/<ngsiVersion>/entities/<entityId>`.

### Queue Name
This converter requires two or more Queues: the one is **Upstream Queue** and the other is **Downstream Queue**.

These Queue Name depends on the following environment variables:

|environment variable|description|default value|
|:--|:--|:--|
|`FIWARE_SERVICE`|the default value of FIWARE-SERVICE|''|
|`FIWARE_SERVICEPATH`|the default value of FIWARE-SERVICEPATH|'/'|
|`QUEUE_DEFS`|the queue definitions like `[{"type":"robot","id":"robot01"},{"type":"robot","id":"robot02"}]` or `[{"type":"robot","fiwareService":"demoservice","fiwareServicePath":"/demo/path"}]`|`[{"type":"type0","id":"id0"}]`|
|`USE_FULLY_QUALIFIED_QUEUE_NAME`|if `true`, FIWARE-SERVICE and FIWARE-SERVICEPATH are included in the Queue Name|`undefined`|
|`AMQP_QUEUE_SEPARATOR`|the separator of the Queue Name|`.`|

When FIWARE-SERVICEPATH is included in the Queue Name, it is converted like below:

1. remove the first "/" if exists.
1. replace "/" to "-".
1. if converted FIWARE-SERVICEPATH becomes empty string, it will be ignored in the Queue Name.

#### Upstream Queue
The Upstream Qureue Name depends on the foloowing environment variables in addition to the above variables:

|environment variable|description|default value|
|:--|:--|:--|
|`UPSTREAM_DATA_MODEL`|if `dm-by-entity`, the `entityId` is included in the Queue Name. if `dm-by-entity-type`, the `entityId` is not included in the QueueName.|`dm-by-entity`|

The following table shows some example of the Upstream Queue Name:

|`FIWARE_SERVICE`|`FIWARE_SERVICEPATH`|`USE_FULLY_QUALIFIED_QUEUE_NAME`|`UPSTREAM_DATA_MODEL`|`QUEUE_DEFS`|Upstream Queue Name|
|:--|:--|:--|:--|:--|:--|
|`fs`|`/fsp`|`false`|`dm-by-entity`|`[{"type":"type0","id":"id0"}]`|`type0.id0.up`|
|`fs`|`/fsp`|`false`|`dm-by-entity-type`|`[{"type":"type0","id":"id0"}]`|`type0.up`|
|`fs`|`/fsp`|`true`|`dm-by-entity`|`[{"type":"type0","id":"id0"}]`|`fs.fsp.type0.id0.up`|
|`fs`|`/fsp`|`true`|`dm-by-entity-type`|`[{"type":"type0","id":"id0"}]`|`fs.fsp.type0.up`|
|`fs`|`/fsp`|`true`|`dm-by-entity`|`[{"type":"type0","id":"id0","fiwareService":"demo","fiwareServicePath":"/demo/path"}]`|`demo.demo-path.type0.id0.up`|
|`fs`|`/fsp`|`true`|`dm-by-entity-type`|`[{"type":"type0","fiwareService":"demo","fiwareServicePath":"/demo/path"}]`|`demo.demo-path.type0.up`|

#### Downsrream Queue
The following table shows some example of the Downstream Queue Name:

|`FIWARE_SERVICE`|`FIWARE_SERVICEPATH`|`USE_FULLY_QUALIFIED_QUEUE_NAME`|`QUEUE_DEFS`|Downstream Queue Name|
|:--|:--|:--|:--|:--|
|`fs`|`/fsp`|`false`|`[{"type":"type0","id":"id0"}]`|`type0.id0.down`|
|`fs`|`/fsp`|`true`|`[{"type":"type0","id":"id0"}]`|`fs.fsp.type0.id0.down`|
|`fs`|`/fsp`|`true`|`[{"type":"type0","id":"id0","fiwareService":"demo","fiwareServicePath":"/demo/path"}]`|`demo.demo-path.type0.id0.down`|

#### Backend
The following table shows some example of the backend service:

|`QUEUE_DEFS`|Backend service|Related environment variables|
|:--|:--|:--|
|`[{"type":"type0","id":"id0"}]`|[FIWARE IoTAgent JSON](https://github.com/telefonicaid/iotagent-json) (default)|`IOTA_HOST`, `IOTA_MANAGE_PORT`, `IOTA_DATA_PORT`|
|`[{"type":"type0","id":"id0","backend":"iotagent"}]`|[FIWARE IoTAgent JSON](https://github.com/telefonicaid/iotagent-json)|`IOTA_HOST`, `IOTA_MANAGE_PORT`, `IOTA_DATA_PORT`|
|`[{"type":"type0","id":"id0","backend":"orion"}]`|[FIWARE Orion](https://github.com/telefonicaid/fiware-orion)|`IOTA_CB_HOST`, `IOTA_CB_PORT`, `IOTA_CB_NGSI_VERSION`|

### Message Format
This converter requires the following message format:

```
{
  "body": '<stringified JSON payload>'
}
```

The `<stringified JSON payload>` depends on the type of message.

#### Upstream Queue
When you use iotagent backend, The Upstream Queue is used to send `attrs` or `cmdexe` messages from device to FIWARE.

* the `<JSON payload>` of `attrs` message which should be stringified

    ```
    {
      "attrs": `<a json object transferfed to IoTAgent json>`
    }
    ```
    * example:

        ```json
        {
          "attrs": {
            "temperature": 25.4
          }
        }
        ```
* the `<JSON payload>` of `cmdexe` message which should be stringified

    ```
    {
      "cmdexe": `<a json object transferfed to IoTAgent json>`
    }
    ```
    * example:

        ```json
        {
          "cmdexe": {
            "open": "window 1 is opened successfully"
          }
        }
        ```

When you use `dm-by-entity-type` as `UPSTREAM_DATA_MODEL`, you have to set the value of `entityId` in the message body.  
The default key of `entityId` is `__id`, but you can change this key name by using `ID_ATTR_NAME`.

* the `attrs` message which includes `entityId`
    * example:

        ```json
        {
          "attrs": {
            "__id": "id0",
            "temperature": 25.4
          }
        }
        ```
* the `cmdexe` message which includes `entityId`
    * example:

        ```json
        {
          "cmdexe": {
            "__id": "id0",
            "open": "window 1 is opened successfully"
          }
        }
        ```

When you use orion backend, received NGSI message will be send to orion directly.

* example:
    ```json
    {
      "id": "urn:ngsi-ld:entity_type:id0",
      "type": "vehicle_location",
      "temperature": {
        "type": "Numeric",
        "value": 25.4
      }
    }
    ```

#### Downstream Queue
When you use iotagent backend, The Downstream Queue is used to send `cmd` message from FIWARE to device.

* the `<JSON payload>` of `cmd` message which should be stringified

    ```
    {
      "cmd": `<a json object transferfed from IoTAgent json>`
    }
    ```
    * example:

        ```json
        {
          "cmd": {
            "open": "window 1"
          }
        }
        ```

## Validation
You can validate the upstream messages by using [json schema](https://json-schema.org/).  
If you want to validate upstream messages, please follow below steps:

1. describe the definitions of the upstream messages as json schema.
1. copy the json files to a directory which is accessible from `amqp10-converter`.
1. set the file paths of the json files as a json array string for each queue to an environment variable `SCHEMA_PATHS` like below:

    ```
    $ export SCHEMA_PATHS='{"fs\\.fsp\\.type0\\.up":["/opt/schema/attr.schema.json","/opt/schema/cmdexe.schema.json"]}'
    ```
    * the key is a regular expression to match the target Upstream Queue Name.
    * When some keys match a Upstream Queue Name, all file paths are merged.
1. start `amqp10-converter`.

This converter will try to validate an arrived upstream message from the beginning of the given json shcema array. This process will stop at the first successful validation, and in which case the arrived upstream message is judged as VALID. Unfortunately if all validations fail, the arrived upstream message is rejected and all following processes are skipped.  
Therefore, if a ton of json schemas are given, they can cause the negative impact of performance.

## Requirements

* [node](https://nodejs.org/en/) 12.16 or higher
* [axios](https://www.npmjs.com/package/axios) 0.19.2
* [express](https://www.npmjs.com/package/express) 4.17.1
* [rhea-promise](https://www.npmjs.com/package/rhea-promise) 1.0.0
* [ajv](https://ajv.js.org/) 6.12.3
* [log4js](https://www.npmjs.com/package/log4js) 6.2.1
* [iotagent-node-lib](https://www.npmjs.com/package/iotagent-node-lib) 2.12.0

## Environment Variables
This converter requires some environment variables like below:

|Environment Variable|Summary|Mandatory|Default|
|:--|:--|:--|:--|
|`AMQP_HOST`|the fqdn of AMQP1.0 Broker|YES|localhost|
|`AMQP_PORT`|the port of AMQP1.0 Broker|YES|5672|
|`AMQP_USE_TLS`|if "true", converter will connect to AMQP1.0 Broker by using TLS|YES||
|`AMQP_USERNAME`|the username of AMQP1.0 Broker|YES|ANONYMOUS|
|`AMQP_PASSWORD`|the password of AMQP1.0 Broker|YES||
|`AMQP_QUEUE_SEPARATOR`|the separator of queue name|No|.|
|`IOTA_HOST`|the hostname of IoTAgent json|YES|localhost|
|`IOTA_MANAGE_PORT`|the northbound port of IoTAgent json|YES|4041|
|`IOTA_DATA_PORT`|the southbound port of IoTAngent json|YES|7896|
|`IOTA_CB_HOST`|the hostname of Context Broker|YES|localhost|
|`IOTA_CB_PORT`|the port of Context Broker|YES|1026|
|`IOTA_CB_NGSI_VERSION`|the NGSI version|No|v2|
|`FIWARE_SERVICE`|default fiware service of IoT device|YES||
|`FIWARE_SERVICEPATH`|default fiware servicepath of IoT device|YES|/|
|`QUEUE_DEFS`|the list of queue name definition|YES|[{"type":"type0","id":"id0"}]|
|`SCHEMA_PATHS`|the list of json schema filepath|NO|{}|
|`UPSTREAM_DATA_MODEL`|if "dm-by-entity", the entity Id is included in the Queue Name. if "dm-by-entity-type", the entity Id is not included in the Queue Name.|NO|dm-by-entity|
|`USE_FULLY_QUALIFIED_QUEUE_NAME`|if "true", FIWARE-SERVICE and FIWARE-SERVICEPATH are included in the Queue Name|NO||
|`ID_ATTR_NAME`|the key name of entityId included in the message body|NO|\_\_id|
|`PORT`|listen port of this service|No|3000|
|`BASE_PATH`|the base path of this servicece|No|/amqp10|
|`LOG_LEVEL`|log level(trace, debug, info, warn, error, fatal)|No|info|

## License

[Apache License 2.0](/LICENSE)

## Copyright
Copyright (c) 2020 [TIS Inc.](https://www.tis.co.jp/)
