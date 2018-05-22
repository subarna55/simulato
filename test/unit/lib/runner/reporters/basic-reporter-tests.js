
'use strict';

const mockery = require('mockery');
const sinon = require('sinon');
const expect = require('chai').expect;

describe('lib/runner/reporters/basic-reporter.js', function() {
  describe('printTestResult', function() {
    let basicReporter;
    let report;
    let symbols;
    let funSymbols;

    beforeEach(function() {
      mockery.enable({useCleanCache: true});
      mockery.registerAllowable('../../../../../lib/runner/reporters/basic-reporter.js');

      sinon.spy(console, 'log');

      symbols = {
        pass: '✓',
        fail: '❌',
        rerun: '⟲',
      };

      funSymbols = {
        pass: '🌴',
        fail: '🍅',
        rerun: '⚠',
      };

      report = {
        testName: 'testName',
        status: 'pass',
        errorLocation: {
          actionIndex: 0,
          step: 'preconditions',
        },
        actions: [
          {
            steps: {
              preconditions: {
                error: {
                  name: 'ERROR NAME',
                  message: 'ERROR MESSAGE',
                  stack: 'an error stack',
                },
                stateCompare: 'state compare string',
              },
            },
          },
        ],
      };

      basicReporter = require('../../../../../lib/runner/reporters/basic-reporter.js');
    });

    afterEach(function() {
      console.log.restore();
      mockery.resetCache();
      mockery.deregisterAll();
      mockery.disable();
    });

    it('should call console.log to print the test name and its status', function() {
      basicReporter.printTestResult(report);

      expect(console.log.args[0]).to.deep.equal([
        `${symbols.pass} testName ${funSymbols.pass}`,
      ]);
    });


    it('should call console.log once', function() {
      basicReporter.printTestResult(report);

      expect(console.log.callCount).to.equal(1);
    });

    describe('if the report has a status of \'fail\'', function() {
      describe('if report.stdErr is truthy', function() {
        it('should call console.log to print the stdErr', function() {
          report.status = 'fail';
          report.stdErr = 'some stdErr',
          delete report.errorLocation;

          basicReporter.printTestResult(report);

          expect(console.log.args[1]).to.deep.equal([
            `\nsome stdErr`,
          ]);
        });

        it('should call console.log twice', function() {
          report.status = 'fail';
          report.stdErr = 'some stdErr',
          delete report.errorLocation;

          basicReporter.printTestResult(report);

          expect(console.log.callCount).to.equal(2);
        });
      });

      describe('if report.errorLocation is truthy', function() {
        it('should call console.log to print the failedSteps error stack', function() {
          report.status = 'fail';
          delete report.actions[0].steps.preconditions.stateCompare;

          basicReporter.printTestResult(report);

          expect(console.log.args[1]).to.deep.equal([
            `\nan error stack`,
          ]);
        });

        it('should call console.log twice', function() {
          report.status = 'fail';
          delete report.actions[0].steps.preconditions.stateCompare;

          basicReporter.printTestResult(report);

          expect(console.log.callCount).to.equal(2);
        });

        describe('if the failedStep has stateCompare', function() {
          it('should call console.log to print the failedSteps error stack', function() {
            report.status = 'fail';

            basicReporter.printTestResult(report);

            expect(console.log.args[2]).to.deep.equal([
              `state compare string\n`,
            ]);
          });

          it('should call console.log thrice', function() {
            report.status = 'fail';

            basicReporter.printTestResult(report);

            expect(console.log.callCount).to.equal(3);
          });
        });
      });
    });
  });

  describe('printReportSummary', function() {
    let basicReporter;
    let report;

    beforeEach(function() {
      mockery.enable({useCleanCache: true});
      mockery.registerAllowable('../../../../../lib/runner/reporters/basic-reporter.js');

      sinon.spy(console, 'log');

      report = {
        status: 'pass',
        testCount: 3,
        failedTestCount: 0,
        time: [20, 234],
        testReports: [],
      };

      basicReporter = require('../../../../../lib/runner/reporters/basic-reporter.js');
    });

    afterEach(function() {
      console.log.restore();
      mockery.resetCache();
      mockery.deregisterAll();
      mockery.disable();
    });

    it('should call console.log with the title for the test summary', function() {
      basicReporter.printReportSummary(report);

      expect(console.log.args[0]).to.deep.equal([
        '\n*** Final Aggregate Test Summary ***',
      ]);
    });

    it('should call console.log to say total tests run using testCount', function() {
      basicReporter.printReportSummary(report);

      expect(console.log.args[1]).to.deep.equal([
        'Total tests run: 3',
      ]);
    });

    it('should call console.log to say total tests passed using testCount & failedTestCount', function() {
      basicReporter.printReportSummary(report);

      expect(console.log.args[2]).to.deep.equal([
        'Tests passed: 3',
      ]);
    });

    it('should call console.log to say total tests failed using failedTestCount', function() {
      basicReporter.printReportSummary(report);

      expect(console.log.args[3]).to.deep.equal([
        'Tests failed: 0',
      ]);
    });

    it('should call console.log to say run time using time array', function() {
      basicReporter.printReportSummary(report);

      expect(console.log.args[4]).to.deep.equal([
        'Run time: 20.234 seconds\n',
      ]);
    });

    describe('if the report.status is set to \'fail\'', function() {
      it('should call console.log to say Failed tests:', function() {
        report.status = 'fail';

        basicReporter.printReportSummary(report);

        expect(console.log.args[5]).to.deep.equal([
          `\x1b[31mFailed Tests:\n\x1b[0m`,
        ]);
      });

      describe('for each testReport of the passed in report.testReports', function() {
        describe('if the testReport.status equals \'fail\'', function() {
          describe('if the testReport.errorLocation property is truthy', function() {
            it('should call console.log to print out an error report', function() {
              report.status = 'fail';
              report.testReports[0] = {
                testName: 'testName',
                status: 'fail',
                errorLocation: {
                  actionIndex: 0,
                  step: 'preconditions',
                },
                actions: [
                  {
                    steps: {
                      preconditions: {
                        error: {
                          name: 'ERROR NAME',
                          message: 'ERROR MESSAGE',
                        },
                      },
                    },
                  },
                ],
              };

              basicReporter.printReportSummary(report);

              expect(console.log.args[6]).to.deep.equal([
                `\u001b[31mtestName: ERROR NAME: ERROR MESSAGE\u001b[0m\n`,
              ]);
            });
          });

          describe('if the testReport.errorLocation property is falsey', function() {
            it('should call console.log to say no report received and to check stdErr', function() {
              report.status = 'fail';
              report.testReports[0] = {
                testName: 'testName',
                status: 'fail',
              };

              basicReporter.printReportSummary(report);

              expect(console.log.args[6]).to.deep.equal([
                `\x1b[31mtestName: No report received from child process check stdErr\x1b[0m\n`,
              ]);
            });
          });
        });

        describe('if the testReport.status does NOT equal \'fail\'', function() {
          it('should only call console.log 6 times', function() {
            report.status = 'fail';
            report.testReports[0] = {
              status: 'pass',
            };

            basicReporter.printReportSummary(report);

            expect(console.log.callCount).to.equal(6);
          });
        });
      });
    });
  });
});