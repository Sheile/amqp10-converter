#!/usr/bin/env python
import sys
import random

from proton.reactor import Container

from producer import Producer
from consumer import Consumer


def attrs():
    temperature = 20.0 + random.random() * 15.0
    payload = {
        'attrs': {
            'temperature': temperature
        }
    }
    producer = Producer(payload)
    Container(producer).run()


def cmd():
    def callback(cmd):
        cmd_name = next(iter(cmd['cmd']))
        payload = {
            'cmdexe': {
                cmd_name: f'processed {cmd["cmd"][cmd_name]}',
            }
        }
        producer = Producer(payload)
        Container(producer).run()

    consumer = Consumer(callback)
    Container(consumer).run()


def dummy():
    payload = {
        'dummy': 'dummy'
    }
    producer = Producer(payload)
    Container(producer).run()


def main(command):
    if command == 'attrs':
        attrs()
    elif command == 'cmd':
        cmd()
    elif command == 'dummy':
        dummy()
    else:
        print(f'unknown cmd ({command})')
        sys.exit(1)


if __name__ == '__main__':
    if len(sys.argv) <= 1:
        print(f'Usage: {sys.argv[0]} attrs|cmd|dummy')
        sys.exit(1)

    main(sys.argv[1])
