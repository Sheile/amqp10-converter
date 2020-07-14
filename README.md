# amqp10-converter
A protocol converter for AMQP 1.0 and FIWARE IoT Agent JSON.

[![Docker badge](https://img.shields.io/docker/pulls/roboticbase/amqp10-converter.svg)](https://hub.docker.com/r/roboticbase/amqp10-converter/)
[![TravisCI Status](https://travis-ci.org/RoboticBase/amqp10-converter.svg?branch=master)](https://travis-ci.org/RoboticBase/amqp10-converter/)

## Description
This converter is designed to be a bridge between [AMQP 1.0](http://www.amqp.org/sites/amqp.org/files/amqp.pdf) and [FIWARE IoTAgent JSON](https://github.com/telefonicaid/iotagent-json). This converter has been confirmed to be able to connect with the following Cloud-Managed Services or OSS:
* [Microsoft Azure ServiceBus](https://azure.microsoft.com/en-us/services/service-bus/)
* [AWS Amazon MQ](https://aws.amazon.com/amazon-mq/)
* [Apache ActiveMQ classic](http://activemq.apache.org/components/classic/) 5.15.9
* [Apache ActiveMQ Artemis](http://activemq.apache.org/components/artemis/) 2.13.0

This converter is based on the [FIWARE IoTAgent JSON](https://github.com/telefonicaid/iotagent-json) and the [IoT Agent Node.js Library](https://github.com/telefonicaid/iotagent-node-lib). Further general information about the FIWARE IoT Agents framework, its architecture and the common interaction model can be found in their GitHub repositories.

## Background
In the Cloud-Native Era, the Cloud-Managed Services have become more useful, more powerful and more desiaalbe. But unfortunately, Cloud-Managed Message Queue Service such as [Microsoft Azure ServiceBus](https://azure.microsoft.com/en-us/services/service-bus/) or [AWS Amazon MQ](https://aws.amazon.com/amazon-mq/) can not handle AMQP 0.9.1 supported by FIWARE IoT Agent.
Therefore this converter was developed to bridge bewteen Cloud-Managed Message Queue Service and FIWARE IoTAgent using AMQP 1.0.

An example is available to try this converter using docker-compose. Please see [example/README.md](example/README.md).

## Caution
Unlike FIWARE IotAgent, **this converter cannot create required Queues corresponding to device Entities automatically** because AMQP 1.0 does not define the APIs for manage Queues. Therefore you have to create the required Queues by yourself **before** starting this converter.

## Naming and Formatting
### Endpoint
The endpoint listening the POST request from IoTAgent JSON is like this: `http://<host>:<port>/<basePath>/cmd/<entityType>/<entityId>`.

The default value of `<basePath>` is "/amqp10", but you can change this by using `BASE_PATH` environment variable if you want.

### Queue Name
This converter requires two Queues: the one is **Upstream Queue** and the other is **Downstream Queue**.

The following table shows the queue names:

|direction|queue name|
|:--|:--|
|Upstream|`<entityType>.<entityId>.up`|
|Downstream|`<entityType>.<entityId>.down`|

The default separator is ".", but you can change this by using `AMQP_QUEUE_SEPARATOR` environment variable if you want.

### Message Format
This converter requires the following message format:

```
{
  "body": '<stringified JSON payload>'
}
```

The `<stringified JSON payload>` depends on the type of message.

#### Upstream Queue
The Upstream Queue is used to send `attrs` or `cmdexe` messages from device to FIWARE.

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

#### Downstream Queue
The Downstream Queue is used to send `cmd` message from FIWARE to device.

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
1. set the file paths of the json files as a json array string to an environment variable `SCHEMA_PATHS` like below:

    ```
    $ export SCHEMA_PATHS='["/opt/schema/attr.schema.json","/opt/schema/cmdexe.schema.json"]'
    ```
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
|`FIWARE_SERVICE`|fiware service of IoT device|YES||
|`FIWARE_SERVICEPATH`|fiware servicepath of IoT device|YES|/|
|`ENTITIES`|the list of entitieType and entityId corresponding to devices|YES|[{"type":"type0","id":"id0"}]|
|`SCHEMA_PATHS`|the list of json schema filepath|NO|[]|
|`PORT`|listen port of this service|No|3000|
|`BASE_PATH`|the base path of this servicece|No|/amqp10|
|`LOG_LEVEL`|log level(trace, debug, info, warn, error, fatal)|No|info|

## License

[Apache License 2.0](/LICENSE)

## Copyright
Copyright (c) 2020 [TIS Inc.](https://www.tis.co.jp/)
