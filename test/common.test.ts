describe('common', () => {
  describe('QueueDef', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let common: any;

    it('convert string to BackendType in constructor', () => {
      jest.isolateModules(() => {
        common = require('@/common');
      });

      const patterns = [
        [common.BackendType.iotagent, common.BackendType.iotagent],
        [common.BackendType.orion, common.BackendType.orion],
        ['iotagent', common.BackendType.iotagent],
        ['orion', common.BackendType.orion],
      ];

      patterns.forEach(test => {
        const queueDef = new common.QueueDef('t01', 'i01', undefined, undefined, test[0]);
        expect(queueDef.backend).toBe(test[1]);
      })
    });

    describe.each([
      [null, 't01', 'i01', 't01.i01.up', 't01.i01.down'],
      [null, '', '', '..up', '..down'],
      [null, 't01', null, 't01..up', 't01..down'],
      ['', 't01', 'i01', 't01.i01.up', 't01.i01.down'],
      ['', '', 'i01', '.i01.up', '.i01.down'],
      ['', '', null, '..up', '..down'],
      ['/', 't01', 'i01', 't01/i01/up', 't01/i01/down'],
      ['/', 't01', '', 't01//up', 't01//down'],
      ['/', 't01', null, 't01//up', 't01//down'],
    ])('when AMQP_QUEUE_SEPARATOR environment variable is "%s"', (separator, type, id, upQueue, downQueue) => {
      beforeEach(() => {
        if (separator != null) process.env.AMQP_QUEUE_SEPARATOR = separator;
      });

      afterEach(() => {
        if (separator != null) delete process.env.AMQP_QUEUE_SEPARATOR;
      });

      it(`QueueDef(type=${type}, id=${id}) => upstreamQueue = ${upQueue}, downstreamQueue = ${downQueue}`, () => {
        jest.isolateModules(() => {
          common = require('@/common');
        });
        const queueDef = (id != null) ? new common.QueueDef(type, id) : new common.QueueDef(type);
        expect(queueDef.upstreamQueue).toBe(upQueue);
        expect(queueDef.downstreamQueue).toBe(downQueue);
      });
    });

    describe.each([
      [null],
      ['false'],
      ['true'],
    ])('when USE_FULLY_QUALIFIED_QUEUE_NAME is %s', (useFQQN) => {
      beforeEach(() => {
        if (useFQQN != null) process.env.USE_FULLY_QUALIFIED_QUEUE_NAME = useFQQN;
      });

      afterEach(() => {
        if (useFQQN != null) delete process.env.USE_FULLY_QUALIFIED_QUEUE_NAME;
      });

      describe.each([
        ['fse', 'fsa', 'fsa'],
        [null, 'fsa', 'fsa'],
        ['fse', undefined, 'fse'],
        [null, undefined, ''],
      ])('when FIWARE_SERVICE is %s and the fiwareService argument of QueueDef is %s', (fse, fsa, fsStr) => {
        beforeEach(() => {
          if (fse != null) process.env.FIWARE_SERVICE = fse;
        });

        afterEach(() => {
          if (fse != null) delete process.env.FIWARE_SERVICE;
        });

        describe.each([
          ['fspe', 'fspa', '.fspa'],
          [null, 'fspa', '.fspa'],
          ['fspe', undefined, '.fspe'],
          [null, undefined, ''],
          ['', '', ''],
          ['/', '/', ''],
          ['/a', '/a', '.a'],
          ['/a/b', '/a/b', '.a-b'],
          ['/a/b/c', '/a/b/c', '.a-b-c'],
          ['/a/b//c/', '/a/b//c/', '.a-b--c-'],
          ['//a/b/c', '//a/b/c', '.-a-b-c'],
        ])('when FIWARE_SERVICEPATH is %s and the fiwareServicePath argument of QueueDef is %s', (fspe, fspa, fspStr) => {
          beforeEach(() => {
            if (fspe != null) process.env.FIWARE_SERVICEPATH = fspe;
          });

          afterEach(() => {
            if (fspe != null) delete process.env.FIWARE_SERVICEPATH;
          });

          describe.each([
            ['t01', 'i01', 't01.i01', 't01'],
            ['t01', '', 't01.', 't01'],
            ['t01', undefined, 't01.', 't01'],
            ['', 'i01', '.i01', ''],
            ['', '', '.', ''],
            ['', undefined, '.', ''],
          ])('when type is %s and id is %s', (type, id, dmByEntityStr, dmByEntityTypeStr) => {
            describe.each([
              [null],
              ['dm-by-entity'],
              ['dm-by-entity-type'],
            ])('when UPSTREAM_DATA_MODEL is %s', (updm) => {
              beforeEach(() => {
                if (updm != null) process.env.UPSTREAM_DATA_MODEL = updm;
              });

              afterEach(() => {
                if (updm != null) delete process.env.UPSTREAM_DATA_MODEL;
              });

              const upQueue = (useFQQN === 'true' && updm === 'dm-by-entity-type') ? `${fsStr}${fspStr}.${dmByEntityTypeStr}.up` :
                              (useFQQN === 'true' && updm !== 'dm-by-entity-type') ? `${fsStr}${fspStr}.${dmByEntityStr}.up` :
                              (useFQQN !== 'true' && updm === 'dm-by-entity-type') ? `${dmByEntityTypeStr}.up` :
                              `${dmByEntityStr}.up`;

              describe.each([
                [null],
                ['dm-by-entity'],
                ['dm-by-entity-type'],
              ])('when DOWNSTREAM_DATA_MODEL is %s', (downdm) => {
                beforeEach(() => {
                  if (downdm != null) process.env.DOWNSTREAM_DATA_MODEL = downdm;
                });

                afterEach(() => {
                  if (downdm != null) delete process.env.DOWNSTREAM_DATA_MODEL;
                });

                const downQueue = (useFQQN === 'true' && downdm === 'dm-by-entity-type') ? `${fsStr}${fspStr}.${dmByEntityTypeStr}.down` :
                                  (useFQQN === 'true' && downdm !== 'dm-by-entity-type') ? `${fsStr}${fspStr}.${dmByEntityStr}.down` :
                                  (useFQQN !== 'true' && downdm === 'dm-by-entity-type') ? `${dmByEntityTypeStr}.down` :
                                  `${dmByEntityStr}.down`;

                it(`QueueDef(type=${type}, id=${id}, fiwareService=${fsa}, fiwareServicepath=${fspa}) => upStreamQueue = ${upQueue}, downStreamQueue = ${downQueue}`, () => {
                  jest.isolateModules(() => {
                    common = require('@/common');
                  });
                  const queueDef = new common.QueueDef(type, id, fsa, fspa);
                  expect(queueDef.upstreamQueue).toBe(upQueue);
                  expect(queueDef.downstreamQueue).toBe(downQueue);
                });
              });
            });
          });
        });
      });
    });

    it.each([
      [[{type: 't'}], true],
      [[{type: 't'},{type: 't', foo: 'bar'}], true],
      [[{type: 't', buz: 0},{type: 't', foo: 'bar'}], true],
      [[], true],
      [[0], false],
      [['t'], false],
      [[{}], false],
      [[{foo: 'bar'}], false],
      [{}, false],
      [null, false],
      ['type', false],
      [0, false],
    ])('QueueDef.isQueueDefs(%o) = %s', (x, result) => {
      jest.isolateModules(() => {
        common = require('@/common');
      });
      expect(common.QueueDef.isQueueDefs(x)).toBe(result);
    });

  });

  describe('Entity', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let common: any;

    it.each([
      ['t01', 'i01'],
    ])('is constructed by type=%s, id=%s', (type, id) => {
      jest.isolateModules(() => {
        common = require('@/common');
      });
      const entity = new common.Entity(type, id);
      expect(entity.type).toBe(type);
      expect(entity.id).toBe(id);
    });

    describe.each([
      [null],
      ['__id'],
      ['i'],
    ])('when ID_ATTR_NAME is %s', (idAttrName) => {
      beforeEach(() => {
        if (idAttrName != null) process.env.ID_ATTR_NAME = idAttrName;
      });

      afterEach(() => {
        if (idAttrName != null) delete process.env.ID_ATTR_NAME;
      });

      describe.each([
        [{ type: 't01', id: 'i01' }, undefined, undefined, undefined],
        [{ type: 't01', id: 'i01' }, {}, undefined, undefined],
        [{ type: 't01', id: undefined }, {}, undefined, undefined],
        [{ type: 't01', id: 'i01' }, {}, 'i02', undefined],
        [{ type: 't01', id: undefined }, {}, 'i02', undefined],
        [{ type: 't01', id: 'i01' }, {}, undefined, 'i03'],
        [{ type: 't01', id: undefined }, {}, undefined, 'i03'],
        [{ type: 't01', id: 'i01' }, {}, 'i02', 'i03'],
        [{ type: 't01', id: undefined }, {},'i02', 'i03'],
      ])('when QudueDef(%o) and data({__id:%s,i:%s})', (qd, data: {__id?: string | undefined; i?: string | undefined} | undefined, __id, i) => {
        const id = (idAttrName === 'i' && i) ? i :
                   (idAttrName !== 'i' && __id) ? __id :
                   (qd.id) ? qd.id :
                   '';

        it(`is constructed by type=${qd.type}, id=${id}`, () => {
          jest.isolateModules(() => {
            common = require('@/common');
          });
          const queueDef = new common.QueueDef(qd.type, qd.id);
          if (data && __id) data['__id'] = __id;
          if (data && i) data['i'] = i;
          const entity = common.Entity.fromData(queueDef, data);
          expect(entity.type).toBe(qd.type);
          expect(entity.id).toBe(id);
        });
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

  describe('sleep', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let common: any;
    beforeEach(() => {
      jest.isolateModules(() => {
        common = require('@/common');
      })
    });

    it('waits given mill sec', async (done) => {
      const timeout = 2;
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      await common.sleep(timeout);

      expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
      expect(setTimeoutSpy.mock.calls[0][1]).toBe(timeout);

      setTimeoutSpy.mockReset();
      setTimeoutSpy.mockRestore();
      done();
    })
  });

});
