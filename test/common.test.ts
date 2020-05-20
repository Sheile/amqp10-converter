describe('common', () => {
  describe('Entity', () => {
    describe.each([
      [null, 't01', 'i01', 't01.i01.up', 't01.i01.down'],
      [null, '', '', '..up', '..down'],
      ['', 't01', 'i01', 't01.i01.up', 't01.i01.down'],
      ['', '', 'i01', '.i01.up', '.i01.down'],
      ['/', 't01', 'i01', 't01/i01/up', 't01/i01/down'],
      ['/', 't01', '', 't01//up', 't01//down'],
    ])('when AMQP_QUEUE_SEPARATOR environment variable is "%s"', (separator, type, id, upQueue, downQueue) => {
      afterEach(() => {
        if (separator != null) delete process.env.AMQP_QUEUE_SEPARATOR;
      });

      it(`Entity(type=${type}, id=${id}).upstreamQueue = ${upQueue}, Entity(type=${type}, id=${id}).downstreamQueue = ${downQueue}`, () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let common: any;
        jest.isolateModules(() => {
          if (separator != null) process.env.AMQP_QUEUE_SEPARATOR = separator;
          common = require('@/common');
        });
        const entity = new common.Entity(type, id);
        expect(entity.upstreamQueue).toBe(upQueue);
        expect(entity.downstreamQueue).toBe(downQueue);
      });
    });
  });

  describe('DeviceMessage', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let common: any;
    beforeEach(() => {
      jest.isolateModules(() => {
        common = require('@/common');
      })
    });

    describe.each([
      ['{"attrs":{"key1":"value1","key2":"value2"}}', 'attrs', { key1: 'value1', key2: 'value2' }],
      ['{"cmd":{"key1":"value1"}}', 'cmd', { key1: 'value1' }],
      ['{"cmdexe": ["abc","def"]}', 'cmdexe', ['abc', 'def']],
      ['{"attrs":{}}', 'attrs', {  }],
      ['{"cmd":[]}', 'cmd', [ ]],
      ['{"cmdexe": ["abc","def"],"attrs":{"key1":"value1","key2":"value2"}}', 'cmdexe', ['abc', 'def']],
    ])('when rawMessage is "%s"', (rawMessage, messageType, data) => {
      it(`DeviceMessage set messageType as "${messageType}" and data as JSON Object`, () => {
        const deviceMessage = new common.DeviceMessage(rawMessage);
        expect(common.MessageType[deviceMessage.messageType]).toBe(messageType);
        expect(deviceMessage.data).toMatchObject(data);
      });
    });

    describe.each([
      ['{"attrs":"dummy"}', 'attrs', 'dummy'],
      ['{"attrs":1}', 'attrs', 1],
      ['{"attrs":true}', 'attrs', true],
      ['{"attrs":null}', 'attrs', null],
      ['{"attrs":"dummy","cmd":1}', 'attrs', 'dummy'],
    ])('when rawMessage is "%s"', (rawMessage, messageType, data) => {
      it(`DeviceMessage set messageType as "${messageType}" and data as primitive object`, () => {
        const deviceMessage = new common.DeviceMessage(rawMessage);
        expect(common.MessageType[deviceMessage.messageType]).toBe(messageType);
        expect(deviceMessage.data).toBe(data);
      });
    });

    describe.each([
      ['{"unknown":{"key1":"value1", "key2":"value2"}}'],
      ['{"":{"key1":"value1", "key2":"value2"}}'],
      ['{"key1":"value1", "key2":"value2"}'],
      ['[1,2,3]'],
      ['1'],
    ])('when rawMessage is "%s"', (rawMessage) => {
      it('DeviceMessage set messageType and data as undefined', () => {
        const deviceMessage = new common.DeviceMessage(rawMessage);
        expect(deviceMessage.messageType).toBeUndefined();
        expect(deviceMessage.data).toBeUndefined();
      });
    });

    describe.each([
      ['{{'],
      ['['],
      [''],
      ['abc'],
    ])('when rawMessage is "%s"', (rawMessage) => {
      it('DeviceMessage raise Error', () => {
        expect(() => {
          new common.DeviceMessage(rawMessage);
        }).toThrowError(SyntaxError);
      });
    });
  });

  describe('isObject', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let common: any;
    beforeEach(() => {
      jest.isolateModules(() => {
        common = require('@/common');
      })
    });

    describe.each([
      [{ a: 'A' }, true],
      [{ a: 'A', b: [1, 2, 3] }, true],
      [{}, true],
      [[1, 2, 3], true],
      [[], true],
      ['a', false],
      ['', false],
      [1, false],
      [true, false],
      [null, false],
      [undefined, false],
    ])('when %o is given', (o, result) => {
      it(`returns ${result}`, () => {
        expect(common.isObject(o)).toBe(result);
      });
    })
  });
});