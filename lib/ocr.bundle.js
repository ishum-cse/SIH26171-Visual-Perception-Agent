(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __commonJS = (cb, mod) => function __require2() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };

  // node_modules/regenerator-runtime/runtime.js
  var require_runtime = __commonJS({
    "node_modules/regenerator-runtime/runtime.js"(exports, module) {
      var runtime = (function(exports2) {
        "use strict";
        var Op = Object.prototype;
        var hasOwn = Op.hasOwnProperty;
        var defineProperty = Object.defineProperty || function(obj, key, desc) {
          obj[key] = desc.value;
        };
        var undefined;
        var $Symbol = typeof Symbol === "function" ? Symbol : {};
        var iteratorSymbol = $Symbol.iterator || "@@iterator";
        var asyncIteratorSymbol = $Symbol.asyncIterator || "@@asyncIterator";
        var toStringTagSymbol = $Symbol.toStringTag || "@@toStringTag";
        function define(obj, key, value) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
          return obj[key];
        }
        try {
          define({}, "");
        } catch (err) {
          define = function(obj, key, value) {
            return obj[key] = value;
          };
        }
        function wrap(innerFn, outerFn, self, tryLocsList) {
          var protoGenerator = outerFn && outerFn.prototype instanceof Generator ? outerFn : Generator;
          var generator = Object.create(protoGenerator.prototype);
          var context = new Context(tryLocsList || []);
          defineProperty(generator, "_invoke", { value: makeInvokeMethod(innerFn, self, context) });
          return generator;
        }
        exports2.wrap = wrap;
        function tryCatch(fn, obj, arg) {
          try {
            return { type: "normal", arg: fn.call(obj, arg) };
          } catch (err) {
            return { type: "throw", arg: err };
          }
        }
        var GenStateSuspendedStart = "suspendedStart";
        var GenStateSuspendedYield = "suspendedYield";
        var GenStateExecuting = "executing";
        var GenStateCompleted = "completed";
        var ContinueSentinel = {};
        function Generator() {
        }
        function GeneratorFunction() {
        }
        function GeneratorFunctionPrototype() {
        }
        var IteratorPrototype = {};
        define(IteratorPrototype, iteratorSymbol, function() {
          return this;
        });
        var getProto = Object.getPrototypeOf;
        var NativeIteratorPrototype = getProto && getProto(getProto(values([])));
        if (NativeIteratorPrototype && NativeIteratorPrototype !== Op && hasOwn.call(NativeIteratorPrototype, iteratorSymbol)) {
          IteratorPrototype = NativeIteratorPrototype;
        }
        var Gp = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(IteratorPrototype);
        GeneratorFunction.prototype = GeneratorFunctionPrototype;
        defineProperty(Gp, "constructor", { value: GeneratorFunctionPrototype, configurable: true });
        defineProperty(
          GeneratorFunctionPrototype,
          "constructor",
          { value: GeneratorFunction, configurable: true }
        );
        GeneratorFunction.displayName = define(
          GeneratorFunctionPrototype,
          toStringTagSymbol,
          "GeneratorFunction"
        );
        function defineIteratorMethods(prototype) {
          ["next", "throw", "return"].forEach(function(method) {
            define(prototype, method, function(arg) {
              return this._invoke(method, arg);
            });
          });
        }
        exports2.isGeneratorFunction = function(genFun) {
          var ctor = typeof genFun === "function" && genFun.constructor;
          return ctor ? ctor === GeneratorFunction || // For the native GeneratorFunction constructor, the best we can
          // do is to check its .name property.
          (ctor.displayName || ctor.name) === "GeneratorFunction" : false;
        };
        exports2.mark = function(genFun) {
          if (Object.setPrototypeOf) {
            Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);
          } else {
            genFun.__proto__ = GeneratorFunctionPrototype;
            define(genFun, toStringTagSymbol, "GeneratorFunction");
          }
          genFun.prototype = Object.create(Gp);
          return genFun;
        };
        exports2.awrap = function(arg) {
          return { __await: arg };
        };
        function AsyncIterator(generator, PromiseImpl) {
          function invoke(method, arg, resolve, reject) {
            var record = tryCatch(generator[method], generator, arg);
            if (record.type === "throw") {
              reject(record.arg);
            } else {
              var result = record.arg;
              var value = result.value;
              if (value && typeof value === "object" && hasOwn.call(value, "__await")) {
                return PromiseImpl.resolve(value.__await).then(function(value2) {
                  invoke("next", value2, resolve, reject);
                }, function(err) {
                  invoke("throw", err, resolve, reject);
                });
              }
              return PromiseImpl.resolve(value).then(function(unwrapped) {
                result.value = unwrapped;
                resolve(result);
              }, function(error) {
                return invoke("throw", error, resolve, reject);
              });
            }
          }
          var previousPromise;
          function enqueue(method, arg) {
            function callInvokeWithMethodAndArg() {
              return new PromiseImpl(function(resolve, reject) {
                invoke(method, arg, resolve, reject);
              });
            }
            return previousPromise = // If enqueue has been called before, then we want to wait until
            // all previous Promises have been resolved before calling invoke,
            // so that results are always delivered in the correct order. If
            // enqueue has not been called before, then it is important to
            // call invoke immediately, without waiting on a callback to fire,
            // so that the async generator function has the opportunity to do
            // any necessary setup in a predictable way. This predictability
            // is why the Promise constructor synchronously invokes its
            // executor callback, and why async functions synchronously
            // execute code before the first await. Since we implement simple
            // async functions in terms of async generators, it is especially
            // important to get this right, even though it requires care.
            previousPromise ? previousPromise.then(
              callInvokeWithMethodAndArg,
              // Avoid propagating failures to Promises returned by later
              // invocations of the iterator.
              callInvokeWithMethodAndArg
            ) : callInvokeWithMethodAndArg();
          }
          defineProperty(this, "_invoke", { value: enqueue });
        }
        defineIteratorMethods(AsyncIterator.prototype);
        define(AsyncIterator.prototype, asyncIteratorSymbol, function() {
          return this;
        });
        exports2.AsyncIterator = AsyncIterator;
        exports2.async = function(innerFn, outerFn, self, tryLocsList, PromiseImpl) {
          if (PromiseImpl === void 0) PromiseImpl = Promise;
          var iter = new AsyncIterator(
            wrap(innerFn, outerFn, self, tryLocsList),
            PromiseImpl
          );
          return exports2.isGeneratorFunction(outerFn) ? iter : iter.next().then(function(result) {
            return result.done ? result.value : iter.next();
          });
        };
        function makeInvokeMethod(innerFn, self, context) {
          var state = GenStateSuspendedStart;
          return function invoke(method, arg) {
            if (state === GenStateExecuting) {
              throw new Error("Generator is already running");
            }
            if (state === GenStateCompleted) {
              if (method === "throw") {
                throw arg;
              }
              return doneResult();
            }
            context.method = method;
            context.arg = arg;
            while (true) {
              var delegate = context.delegate;
              if (delegate) {
                var delegateResult = maybeInvokeDelegate(delegate, context);
                if (delegateResult) {
                  if (delegateResult === ContinueSentinel) continue;
                  return delegateResult;
                }
              }
              if (context.method === "next") {
                context.sent = context._sent = context.arg;
              } else if (context.method === "throw") {
                if (state === GenStateSuspendedStart) {
                  state = GenStateCompleted;
                  throw context.arg;
                }
                context.dispatchException(context.arg);
              } else if (context.method === "return") {
                context.abrupt("return", context.arg);
              }
              state = GenStateExecuting;
              var record = tryCatch(innerFn, self, context);
              if (record.type === "normal") {
                state = context.done ? GenStateCompleted : GenStateSuspendedYield;
                if (record.arg === ContinueSentinel) {
                  continue;
                }
                return {
                  value: record.arg,
                  done: context.done
                };
              } else if (record.type === "throw") {
                state = GenStateCompleted;
                context.method = "throw";
                context.arg = record.arg;
              }
            }
          };
        }
        function maybeInvokeDelegate(delegate, context) {
          var methodName = context.method;
          var method = delegate.iterator[methodName];
          if (method === undefined) {
            context.delegate = null;
            if (methodName === "throw" && delegate.iterator["return"]) {
              context.method = "return";
              context.arg = undefined;
              maybeInvokeDelegate(delegate, context);
              if (context.method === "throw") {
                return ContinueSentinel;
              }
            }
            if (methodName !== "return") {
              context.method = "throw";
              context.arg = new TypeError(
                "The iterator does not provide a '" + methodName + "' method"
              );
            }
            return ContinueSentinel;
          }
          var record = tryCatch(method, delegate.iterator, context.arg);
          if (record.type === "throw") {
            context.method = "throw";
            context.arg = record.arg;
            context.delegate = null;
            return ContinueSentinel;
          }
          var info = record.arg;
          if (!info) {
            context.method = "throw";
            context.arg = new TypeError("iterator result is not an object");
            context.delegate = null;
            return ContinueSentinel;
          }
          if (info.done) {
            context[delegate.resultName] = info.value;
            context.next = delegate.nextLoc;
            if (context.method !== "return") {
              context.method = "next";
              context.arg = undefined;
            }
          } else {
            return info;
          }
          context.delegate = null;
          return ContinueSentinel;
        }
        defineIteratorMethods(Gp);
        define(Gp, toStringTagSymbol, "Generator");
        define(Gp, iteratorSymbol, function() {
          return this;
        });
        define(Gp, "toString", function() {
          return "[object Generator]";
        });
        function pushTryEntry(locs) {
          var entry = { tryLoc: locs[0] };
          if (1 in locs) {
            entry.catchLoc = locs[1];
          }
          if (2 in locs) {
            entry.finallyLoc = locs[2];
            entry.afterLoc = locs[3];
          }
          this.tryEntries.push(entry);
        }
        function resetTryEntry(entry) {
          var record = entry.completion || {};
          record.type = "normal";
          delete record.arg;
          entry.completion = record;
        }
        function Context(tryLocsList) {
          this.tryEntries = [{ tryLoc: "root" }];
          tryLocsList.forEach(pushTryEntry, this);
          this.reset(true);
        }
        exports2.keys = function(val) {
          var object = Object(val);
          var keys = [];
          for (var key in object) {
            keys.push(key);
          }
          keys.reverse();
          return function next() {
            while (keys.length) {
              var key2 = keys.pop();
              if (key2 in object) {
                next.value = key2;
                next.done = false;
                return next;
              }
            }
            next.done = true;
            return next;
          };
        };
        function values(iterable) {
          if (iterable) {
            var iteratorMethod = iterable[iteratorSymbol];
            if (iteratorMethod) {
              return iteratorMethod.call(iterable);
            }
            if (typeof iterable.next === "function") {
              return iterable;
            }
            if (!isNaN(iterable.length)) {
              var i = -1, next = function next2() {
                while (++i < iterable.length) {
                  if (hasOwn.call(iterable, i)) {
                    next2.value = iterable[i];
                    next2.done = false;
                    return next2;
                  }
                }
                next2.value = undefined;
                next2.done = true;
                return next2;
              };
              return next.next = next;
            }
          }
          return { next: doneResult };
        }
        exports2.values = values;
        function doneResult() {
          return { value: undefined, done: true };
        }
        Context.prototype = {
          constructor: Context,
          reset: function(skipTempReset) {
            this.prev = 0;
            this.next = 0;
            this.sent = this._sent = undefined;
            this.done = false;
            this.delegate = null;
            this.method = "next";
            this.arg = undefined;
            this.tryEntries.forEach(resetTryEntry);
            if (!skipTempReset) {
              for (var name in this) {
                if (name.charAt(0) === "t" && hasOwn.call(this, name) && !isNaN(+name.slice(1))) {
                  this[name] = undefined;
                }
              }
            }
          },
          stop: function() {
            this.done = true;
            var rootEntry = this.tryEntries[0];
            var rootRecord = rootEntry.completion;
            if (rootRecord.type === "throw") {
              throw rootRecord.arg;
            }
            return this.rval;
          },
          dispatchException: function(exception) {
            if (this.done) {
              throw exception;
            }
            var context = this;
            function handle(loc, caught) {
              record.type = "throw";
              record.arg = exception;
              context.next = loc;
              if (caught) {
                context.method = "next";
                context.arg = undefined;
              }
              return !!caught;
            }
            for (var i = this.tryEntries.length - 1; i >= 0; --i) {
              var entry = this.tryEntries[i];
              var record = entry.completion;
              if (entry.tryLoc === "root") {
                return handle("end");
              }
              if (entry.tryLoc <= this.prev) {
                var hasCatch = hasOwn.call(entry, "catchLoc");
                var hasFinally = hasOwn.call(entry, "finallyLoc");
                if (hasCatch && hasFinally) {
                  if (this.prev < entry.catchLoc) {
                    return handle(entry.catchLoc, true);
                  } else if (this.prev < entry.finallyLoc) {
                    return handle(entry.finallyLoc);
                  }
                } else if (hasCatch) {
                  if (this.prev < entry.catchLoc) {
                    return handle(entry.catchLoc, true);
                  }
                } else if (hasFinally) {
                  if (this.prev < entry.finallyLoc) {
                    return handle(entry.finallyLoc);
                  }
                } else {
                  throw new Error("try statement without catch or finally");
                }
              }
            }
          },
          abrupt: function(type, arg) {
            for (var i = this.tryEntries.length - 1; i >= 0; --i) {
              var entry = this.tryEntries[i];
              if (entry.tryLoc <= this.prev && hasOwn.call(entry, "finallyLoc") && this.prev < entry.finallyLoc) {
                var finallyEntry = entry;
                break;
              }
            }
            if (finallyEntry && (type === "break" || type === "continue") && finallyEntry.tryLoc <= arg && arg <= finallyEntry.finallyLoc) {
              finallyEntry = null;
            }
            var record = finallyEntry ? finallyEntry.completion : {};
            record.type = type;
            record.arg = arg;
            if (finallyEntry) {
              this.method = "next";
              this.next = finallyEntry.finallyLoc;
              return ContinueSentinel;
            }
            return this.complete(record);
          },
          complete: function(record, afterLoc) {
            if (record.type === "throw") {
              throw record.arg;
            }
            if (record.type === "break" || record.type === "continue") {
              this.next = record.arg;
            } else if (record.type === "return") {
              this.rval = this.arg = record.arg;
              this.method = "return";
              this.next = "end";
            } else if (record.type === "normal" && afterLoc) {
              this.next = afterLoc;
            }
            return ContinueSentinel;
          },
          finish: function(finallyLoc) {
            for (var i = this.tryEntries.length - 1; i >= 0; --i) {
              var entry = this.tryEntries[i];
              if (entry.finallyLoc === finallyLoc) {
                this.complete(entry.completion, entry.afterLoc);
                resetTryEntry(entry);
                return ContinueSentinel;
              }
            }
          },
          "catch": function(tryLoc) {
            for (var i = this.tryEntries.length - 1; i >= 0; --i) {
              var entry = this.tryEntries[i];
              if (entry.tryLoc === tryLoc) {
                var record = entry.completion;
                if (record.type === "throw") {
                  var thrown = record.arg;
                  resetTryEntry(entry);
                }
                return thrown;
              }
            }
            throw new Error("illegal catch attempt");
          },
          delegateYield: function(iterable, resultName, nextLoc) {
            this.delegate = {
              iterator: values(iterable),
              resultName,
              nextLoc
            };
            if (this.method === "next") {
              this.arg = undefined;
            }
            return ContinueSentinel;
          }
        };
        return exports2;
      })(
        // If this script is executing as a CommonJS module, use module.exports
        // as the regeneratorRuntime namespace. Otherwise create a new empty
        // object. Either way, the resulting object will be used to initialize
        // the regeneratorRuntime variable at the top of this file.
        typeof module === "object" ? module.exports : {}
      );
      try {
        regeneratorRuntime = runtime;
      } catch (accidentalStrictMode) {
        if (typeof globalThis === "object") {
          globalThis.regeneratorRuntime = runtime;
        } else {
          Function("r", "regeneratorRuntime = r")(runtime);
        }
      }
    }
  });

  // node_modules/tesseract.js/src/utils/getId.js
  var require_getId = __commonJS({
    "node_modules/tesseract.js/src/utils/getId.js"(exports, module) {
      "use strict";
      module.exports = (prefix, cnt) => `${prefix}-${cnt}-${Math.random().toString(16).slice(3, 8)}`;
    }
  });

  // node_modules/tesseract.js/src/createJob.js
  var require_createJob = __commonJS({
    "node_modules/tesseract.js/src/createJob.js"(exports, module) {
      "use strict";
      var getId = require_getId();
      var jobCounter = 0;
      module.exports = ({
        id: _id,
        action,
        payload = {}
      }) => {
        let id = _id;
        if (typeof id === "undefined") {
          id = getId("Job", jobCounter);
          jobCounter += 1;
        }
        return {
          id,
          action,
          payload
        };
      };
    }
  });

  // node_modules/tesseract.js/src/utils/log.js
  var require_log = __commonJS({
    "node_modules/tesseract.js/src/utils/log.js"(exports) {
      "use strict";
      var logging = false;
      exports.logging = logging;
      exports.setLogging = (_logging) => {
        logging = _logging;
      };
      exports.log = (...args) => logging ? console.log.apply(exports, args) : null;
    }
  });

  // node_modules/tesseract.js/src/createScheduler.js
  var require_createScheduler = __commonJS({
    "node_modules/tesseract.js/src/createScheduler.js"(exports, module) {
      "use strict";
      var createJob = require_createJob();
      var { log } = require_log();
      var getId = require_getId();
      var schedulerCounter = 0;
      module.exports = () => {
        const id = getId("Scheduler", schedulerCounter);
        const workers = {};
        const runningWorkers = {};
        let jobQueue = [];
        schedulerCounter += 1;
        const getQueueLen = () => jobQueue.length;
        const getNumWorkers = () => Object.keys(workers).length;
        const dequeue = () => {
          if (jobQueue.length !== 0) {
            const wIds = Object.keys(workers);
            for (let i = 0; i < wIds.length; i += 1) {
              if (typeof runningWorkers[wIds[i]] === "undefined") {
                jobQueue[0](workers[wIds[i]]);
                break;
              }
            }
          }
        };
        const queue = (action, payload) => new Promise((resolve, reject) => {
          const job = createJob({ action, payload });
          jobQueue.push(async (w) => {
            jobQueue.shift();
            runningWorkers[w.id] = job;
            try {
              resolve(await w[action].apply(exports, [...payload, job.id]));
            } catch (err) {
              reject(err);
            } finally {
              delete runningWorkers[w.id];
              dequeue();
            }
          });
          log(`[${id}]: Add ${job.id} to JobQueue`);
          log(`[${id}]: JobQueue length=${jobQueue.length}`);
          dequeue();
        });
        const addWorker = (w) => {
          workers[w.id] = w;
          log(`[${id}]: Add ${w.id}`);
          log(`[${id}]: Number of workers=${getNumWorkers()}`);
          dequeue();
          return w.id;
        };
        const addJob = async (action, ...payload) => {
          if (getNumWorkers() === 0) {
            throw Error(`[${id}]: You need to have at least one worker before adding jobs`);
          }
          return queue(action, payload);
        };
        const terminate = async () => {
          Object.keys(workers).forEach(async (wid) => {
            await workers[wid].terminate();
          });
          jobQueue = [];
        };
        return {
          addWorker,
          addJob,
          terminate,
          getQueueLen,
          getNumWorkers
        };
      };
    }
  });

  // node_modules/tesseract.js/src/utils/getEnvironment.js
  var require_getEnvironment = __commonJS({
    "node_modules/tesseract.js/src/utils/getEnvironment.js"(exports, module) {
      "use strict";
      module.exports = (key) => {
        const env = {};
        if (typeof WorkerGlobalScope !== "undefined") {
          env.type = "webworker";
        } else if (typeof document === "object") {
          env.type = "browser";
        } else if (typeof process === "object" && typeof __require === "function") {
          env.type = "node";
        }
        if (typeof key === "undefined") {
          return env;
        }
        return env[key];
      };
    }
  });

  // node_modules/tesseract.js/src/utils/resolvePaths.js
  var require_resolvePaths = __commonJS({
    "node_modules/tesseract.js/src/utils/resolvePaths.js"(exports, module) {
      "use strict";
      var isBrowser = require_getEnvironment()("type") === "browser";
      var resolveURL = isBrowser ? (s) => new URL(s, window.location.href).href : (s) => s;
      module.exports = (options) => {
        const opts = { ...options };
        ["corePath", "workerPath", "langPath"].forEach((key) => {
          if (options[key]) {
            opts[key] = resolveURL(opts[key]);
          }
        });
        return opts;
      };
    }
  });

  // node_modules/tesseract.js/src/constants/OEM.js
  var require_OEM = __commonJS({
    "node_modules/tesseract.js/src/constants/OEM.js"(exports, module) {
      "use strict";
      module.exports = {
        TESSERACT_ONLY: 0,
        LSTM_ONLY: 1,
        TESSERACT_LSTM_COMBINED: 2,
        DEFAULT: 3
      };
    }
  });

  // node_modules/tesseract.js/package.json
  var require_package = __commonJS({
    "node_modules/tesseract.js/package.json"(exports, module) {
      module.exports = {
        name: "tesseract.js",
        version: "7.0.0",
        description: "Pure Javascript Multilingual OCR",
        main: "src/index.js",
        type: "commonjs",
        types: "src/index.d.ts",
        unpkg: "dist/tesseract.min.js",
        jsdelivr: "dist/tesseract.min.js",
        scripts: {
          start: "node scripts/server.js",
          build: "rimraf dist && webpack --config scripts/webpack.config.prod.js && rollup -c scripts/rollup.esm.mjs",
          "profile:tesseract": "webpack-bundle-analyzer dist/tesseract-stats.json",
          "profile:worker": "webpack-bundle-analyzer dist/worker-stats.json",
          prepublishOnly: "npm run build",
          wait: "rimraf dist && wait-on http://localhost:3000/dist/tesseract.min.js",
          test: "npm-run-all -p -r start test:all",
          "test:all": "npm-run-all wait test:browser test:node:all",
          "test:browser": "karma start karma.conf.js",
          "test:node": "nyc mocha --exit --bail --require ./scripts/test-helper.mjs",
          "test:node:all": "npm run test:node -- ./tests/*.test.mjs",
          lint: "eslint src",
          "lint:fix": "eslint --fix src",
          postinstall: "opencollective-postinstall || true"
        },
        browser: {
          "./src/worker/node/index.js": "./src/worker/browser/index.js"
        },
        author: "",
        contributors: [
          "jeromewu"
        ],
        license: "Apache-2.0",
        devDependencies: {
          "@babel/core": "^7.21.4",
          "@babel/eslint-parser": "^7.21.3",
          "@babel/preset-env": "^7.21.4",
          "@rollup/plugin-commonjs": "^24.1.0",
          acorn: "^8.8.2",
          "babel-loader": "^9.1.2",
          buffer: "^6.0.3",
          cors: "^2.8.5",
          eslint: "^7.32.0",
          "eslint-config-airbnb-base": "^14.2.1",
          "eslint-plugin-import": "^2.27.5",
          "expect.js": "^0.3.1",
          express: "^4.18.2",
          mocha: "^10.2.0",
          "npm-run-all": "^4.1.5",
          karma: "^6.4.2",
          "karma-chrome-launcher": "^3.2.0",
          "karma-firefox-launcher": "^2.1.2",
          "karma-mocha": "^2.0.1",
          "karma-webpack": "^5.0.0",
          nyc: "^15.1.0",
          rimraf: "^5.0.0",
          rollup: "^3.20.7",
          "wait-on": "^7.0.1",
          webpack: "^5.79.0",
          "webpack-bundle-analyzer": "^4.8.0",
          "webpack-cli": "^5.0.1",
          "webpack-dev-middleware": "^6.0.2",
          "rollup-plugin-sourcemaps": "^0.6.3"
        },
        dependencies: {
          "bmp-js": "^0.1.0",
          "idb-keyval": "^6.2.0",
          "is-url": "^1.2.4",
          "node-fetch": "^2.6.9",
          "opencollective-postinstall": "^2.0.3",
          "regenerator-runtime": "^0.13.3",
          "tesseract.js-core": "^7.0.0",
          "wasm-feature-detect": "^1.8.0",
          zlibjs: "^0.3.1"
        },
        overrides: {
          "@rollup/pluginutils": "^5.0.2"
        },
        repository: {
          type: "git",
          url: "https://github.com/naptha/tesseract.js.git"
        },
        bugs: {
          url: "https://github.com/naptha/tesseract.js/issues"
        },
        homepage: "https://github.com/naptha/tesseract.js",
        collective: {
          type: "opencollective",
          url: "https://opencollective.com/tesseractjs"
        }
      };
    }
  });

  // node_modules/tesseract.js/src/constants/defaultOptions.js
  var require_defaultOptions = __commonJS({
    "node_modules/tesseract.js/src/constants/defaultOptions.js"(exports, module) {
      "use strict";
      module.exports = {
        /*
         * Use BlobURL for worker script by default
         * TODO: remove this option
         *
         */
        workerBlobURL: true,
        logger: () => {
        }
      };
    }
  });

  // node_modules/tesseract.js/src/worker/browser/defaultOptions.js
  var require_defaultOptions2 = __commonJS({
    "node_modules/tesseract.js/src/worker/browser/defaultOptions.js"(exports, module) {
      "use strict";
      var version = require_package().version;
      var defaultOptions = require_defaultOptions();
      module.exports = {
        ...defaultOptions,
        workerPath: `https://cdn.jsdelivr.net/npm/tesseract.js@v${version}/dist/worker.min.js`
      };
    }
  });

  // node_modules/tesseract.js/src/worker/browser/spawnWorker.js
  var require_spawnWorker = __commonJS({
    "node_modules/tesseract.js/src/worker/browser/spawnWorker.js"(exports, module) {
      "use strict";
      module.exports = ({ workerPath, workerBlobURL }) => {
        let worker;
        if (Blob && URL && workerBlobURL) {
          const blob = new Blob([`importScripts("${workerPath}");`], {
            type: "application/javascript"
          });
          worker = new Worker(URL.createObjectURL(blob));
        } else {
          worker = new Worker(workerPath);
        }
        return worker;
      };
    }
  });

  // node_modules/tesseract.js/src/worker/browser/terminateWorker.js
  var require_terminateWorker = __commonJS({
    "node_modules/tesseract.js/src/worker/browser/terminateWorker.js"(exports, module) {
      "use strict";
      module.exports = (worker) => {
        worker.terminate();
      };
    }
  });

  // node_modules/tesseract.js/src/worker/browser/onMessage.js
  var require_onMessage = __commonJS({
    "node_modules/tesseract.js/src/worker/browser/onMessage.js"(exports, module) {
      "use strict";
      module.exports = (worker, handler) => {
        worker.onmessage = ({ data }) => {
          handler(data);
        };
      };
    }
  });

  // node_modules/tesseract.js/src/worker/browser/send.js
  var require_send = __commonJS({
    "node_modules/tesseract.js/src/worker/browser/send.js"(exports, module) {
      "use strict";
      module.exports = async (worker, packet) => {
        worker.postMessage(packet);
      };
    }
  });

  // node_modules/tesseract.js/src/worker/browser/loadImage.js
  var require_loadImage = __commonJS({
    "node_modules/tesseract.js/src/worker/browser/loadImage.js"(exports, module) {
      "use strict";
      var readFromBlobOrFile = (blob) => new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.onload = () => {
          resolve(fileReader.result);
        };
        fileReader.onerror = ({ target: { error: { code } } }) => {
          reject(Error(`File could not be read! Code=${code}`));
        };
        fileReader.readAsArrayBuffer(blob);
      });
      var loadImage = async (image) => {
        let data = image;
        if (typeof image === "undefined") {
          return "undefined";
        }
        if (typeof image === "string") {
          if (/data:image\/([a-zA-Z]*);base64,([^"]*)/.test(image)) {
            data = atob(image.split(",")[1]).split("").map((c) => c.charCodeAt(0));
          } else {
            const resp = await fetch(image);
            data = await resp.arrayBuffer();
          }
        } else if (typeof HTMLElement !== "undefined" && image instanceof HTMLElement) {
          if (image.tagName === "IMG") {
            data = await loadImage(image.src);
          }
          if (image.tagName === "VIDEO") {
            data = await loadImage(image.poster);
          }
          if (image.tagName === "CANVAS") {
            await new Promise((resolve) => {
              image.toBlob(async (blob) => {
                data = await readFromBlobOrFile(blob);
                resolve();
              });
            });
          }
        } else if (typeof OffscreenCanvas !== "undefined" && image instanceof OffscreenCanvas) {
          const blob = await image.convertToBlob();
          data = await readFromBlobOrFile(blob);
        } else if (image instanceof File || image instanceof Blob) {
          data = await readFromBlobOrFile(image);
        }
        return new Uint8Array(data);
      };
      module.exports = loadImage;
    }
  });

  // node_modules/tesseract.js/src/worker/browser/index.js
  var require_browser = __commonJS({
    "node_modules/tesseract.js/src/worker/browser/index.js"(exports, module) {
      "use strict";
      var defaultOptions = require_defaultOptions2();
      var spawnWorker = require_spawnWorker();
      var terminateWorker = require_terminateWorker();
      var onMessage = require_onMessage();
      var send = require_send();
      var loadImage = require_loadImage();
      module.exports = {
        defaultOptions,
        spawnWorker,
        terminateWorker,
        onMessage,
        send,
        loadImage
      };
    }
  });

  // node_modules/tesseract.js/src/createWorker.js
  var require_createWorker = __commonJS({
    "node_modules/tesseract.js/src/createWorker.js"(exports, module) {
      "use strict";
      var resolvePaths = require_resolvePaths();
      var createJob = require_createJob();
      var { log } = require_log();
      var getId = require_getId();
      var OEM = require_OEM();
      var {
        defaultOptions,
        spawnWorker,
        terminateWorker,
        onMessage,
        loadImage,
        send
      } = require_browser();
      var workerCounter = 0;
      module.exports = async (langs = "eng", oem = OEM.LSTM_ONLY, _options = {}, config = {}) => {
        const id = getId("Worker", workerCounter);
        const {
          logger,
          errorHandler,
          ...options
        } = resolvePaths({
          ...defaultOptions,
          ..._options
        });
        const promises = {};
        const currentLangs = typeof langs === "string" ? langs.split("+") : langs;
        let currentOem = oem;
        let currentConfig = config;
        const lstmOnlyCore = [OEM.DEFAULT, OEM.LSTM_ONLY].includes(oem) && !options.legacyCore;
        let workerResReject;
        let workerResResolve;
        const workerRes = new Promise((resolve, reject) => {
          workerResResolve = resolve;
          workerResReject = reject;
        });
        const workerError = (event) => {
          workerResReject(event.message);
        };
        let worker = spawnWorker(options);
        worker.onerror = workerError;
        workerCounter += 1;
        const startJob = ({ id: jobId, action, payload }) => new Promise((resolve, reject) => {
          log(`[${id}]: Start ${jobId}, action=${action}`);
          const promiseId = `${action}-${jobId}`;
          promises[promiseId] = { resolve, reject };
          send(worker, {
            workerId: id,
            jobId,
            action,
            payload
          });
        });
        const load = () => console.warn("`load` is depreciated and should be removed from code (workers now come pre-loaded)");
        const loadInternal = (jobId) => startJob(createJob({
          id: jobId,
          action: "load",
          payload: { options: { lstmOnly: lstmOnlyCore, corePath: options.corePath, logging: options.logging } }
        }));
        const writeText = (path, text, jobId) => startJob(createJob({
          id: jobId,
          action: "FS",
          payload: { method: "writeFile", args: [path, text] }
        }));
        const readText = (path, jobId) => startJob(createJob({
          id: jobId,
          action: "FS",
          payload: { method: "readFile", args: [path, { encoding: "utf8" }] }
        }));
        const removeFile = (path, jobId) => startJob(createJob({
          id: jobId,
          action: "FS",
          payload: { method: "unlink", args: [path] }
        }));
        const FS = (method, args, jobId) => startJob(createJob({
          id: jobId,
          action: "FS",
          payload: { method, args }
        }));
        const loadLanguageInternal = (_langs, jobId) => startJob(createJob({
          id: jobId,
          action: "loadLanguage",
          payload: {
            langs: _langs,
            options: {
              langPath: options.langPath,
              dataPath: options.dataPath,
              cachePath: options.cachePath,
              cacheMethod: options.cacheMethod,
              gzip: options.gzip,
              lstmOnly: [OEM.DEFAULT, OEM.LSTM_ONLY].includes(currentOem) && !options.legacyLang
            }
          }
        }));
        const initializeInternal = (_langs, _oem, _config, jobId) => startJob(createJob({
          id: jobId,
          action: "initialize",
          payload: { langs: _langs, oem: _oem, config: _config }
        }));
        const reinitialize = (langs2 = "eng", oem2, config2, jobId) => {
          if (lstmOnlyCore && [OEM.TESSERACT_ONLY, OEM.TESSERACT_LSTM_COMBINED].includes(oem2)) throw Error("Legacy model requested but code missing.");
          const _oem = oem2 || currentOem;
          currentOem = _oem;
          const _config = config2 || currentConfig;
          currentConfig = _config;
          const langsArr = typeof langs2 === "string" ? langs2.split("+") : langs2;
          const _langs = langsArr.filter((x) => !currentLangs.includes(x));
          currentLangs.push(..._langs);
          if (_langs.length > 0) {
            return loadLanguageInternal(_langs, jobId).then(() => initializeInternal(langs2, _oem, _config, jobId));
          }
          return initializeInternal(langs2, _oem, _config, jobId);
        };
        const setParameters = (params = {}, jobId) => startJob(createJob({
          id: jobId,
          action: "setParameters",
          payload: { params }
        }));
        const recognize = async (image, opts = {}, output = {
          text: true
        }, jobId) => startJob(createJob({
          id: jobId,
          action: "recognize",
          payload: { image: await loadImage(image), options: opts, output }
        }));
        const detect = async (image, jobId) => {
          if (lstmOnlyCore) throw Error("`worker.detect` requires Legacy model, which was not loaded.");
          return startJob(createJob({
            id: jobId,
            action: "detect",
            payload: { image: await loadImage(image) }
          }));
        };
        const terminate = async () => {
          if (worker !== null) {
            terminateWorker(worker);
            worker = null;
          }
          return Promise.resolve();
        };
        onMessage(worker, ({
          workerId,
          jobId,
          status,
          action,
          data
        }) => {
          const promiseId = `${action}-${jobId}`;
          if (status === "resolve") {
            log(`[${workerId}]: Complete ${jobId}`);
            promises[promiseId].resolve({ jobId, data });
            delete promises[promiseId];
          } else if (status === "reject") {
            promises[promiseId].reject(data);
            delete promises[promiseId];
            if (action === "load") workerResReject(data);
            if (errorHandler) {
              errorHandler(data);
            } else {
              throw Error(data);
            }
          } else if (status === "progress") {
            logger({ ...data, userJobId: jobId });
          }
        });
        const resolveObj = {
          id,
          worker,
          load,
          writeText,
          readText,
          removeFile,
          FS,
          reinitialize,
          setParameters,
          recognize,
          detect,
          terminate
        };
        loadInternal().then(() => loadLanguageInternal(langs)).then(() => initializeInternal(langs, oem, config)).then(() => workerResResolve(resolveObj)).catch(() => {
        });
        return workerRes;
      };
    }
  });

  // node_modules/tesseract.js/src/Tesseract.js
  var require_Tesseract = __commonJS({
    "node_modules/tesseract.js/src/Tesseract.js"(exports, module) {
      "use strict";
      var createWorker = require_createWorker();
      var recognize = async (image, langs, options) => {
        const worker = await createWorker(langs, 1, options);
        return worker.recognize(image).finally(async () => {
          await worker.terminate();
        });
      };
      var detect = async (image, options) => {
        const worker = await createWorker("osd", 0, options);
        return worker.detect(image).finally(async () => {
          await worker.terminate();
        });
      };
      module.exports = {
        recognize,
        detect
      };
    }
  });

  // node_modules/tesseract.js/src/constants/languages.js
  var require_languages = __commonJS({
    "node_modules/tesseract.js/src/constants/languages.js"(exports, module) {
      "use strict";
      module.exports = {
        AFR: "afr",
        AMH: "amh",
        ARA: "ara",
        ASM: "asm",
        AZE: "aze",
        AZE_CYRL: "aze_cyrl",
        BEL: "bel",
        BEN: "ben",
        BOD: "bod",
        BOS: "bos",
        BUL: "bul",
        CAT: "cat",
        CEB: "ceb",
        CES: "ces",
        CHI_SIM: "chi_sim",
        CHI_TRA: "chi_tra",
        CHR: "chr",
        CYM: "cym",
        DAN: "dan",
        DEU: "deu",
        DZO: "dzo",
        ELL: "ell",
        ENG: "eng",
        ENM: "enm",
        EPO: "epo",
        EST: "est",
        EUS: "eus",
        FAS: "fas",
        FIN: "fin",
        FRA: "fra",
        FRK: "frk",
        FRM: "frm",
        GLE: "gle",
        GLG: "glg",
        GRC: "grc",
        GUJ: "guj",
        HAT: "hat",
        HEB: "heb",
        HIN: "hin",
        HRV: "hrv",
        HUN: "hun",
        IKU: "iku",
        IND: "ind",
        ISL: "isl",
        ITA: "ita",
        ITA_OLD: "ita_old",
        JAV: "jav",
        JPN: "jpn",
        KAN: "kan",
        KAT: "kat",
        KAT_OLD: "kat_old",
        KAZ: "kaz",
        KHM: "khm",
        KIR: "kir",
        KOR: "kor",
        KUR: "kur",
        LAO: "lao",
        LAT: "lat",
        LAV: "lav",
        LIT: "lit",
        MAL: "mal",
        MAR: "mar",
        MKD: "mkd",
        MLT: "mlt",
        MSA: "msa",
        MYA: "mya",
        NEP: "nep",
        NLD: "nld",
        NOR: "nor",
        ORI: "ori",
        PAN: "pan",
        POL: "pol",
        POR: "por",
        PUS: "pus",
        RON: "ron",
        RUS: "rus",
        SAN: "san",
        SIN: "sin",
        SLK: "slk",
        SLV: "slv",
        SPA: "spa",
        SPA_OLD: "spa_old",
        SQI: "sqi",
        SRP: "srp",
        SRP_LATN: "srp_latn",
        SWA: "swa",
        SWE: "swe",
        SYR: "syr",
        TAM: "tam",
        TEL: "tel",
        TGK: "tgk",
        TGL: "tgl",
        THA: "tha",
        TIR: "tir",
        TUR: "tur",
        UIG: "uig",
        UKR: "ukr",
        URD: "urd",
        UZB: "uzb",
        UZB_CYRL: "uzb_cyrl",
        VIE: "vie",
        YID: "yid"
      };
    }
  });

  // node_modules/tesseract.js/src/constants/PSM.js
  var require_PSM = __commonJS({
    "node_modules/tesseract.js/src/constants/PSM.js"(exports, module) {
      "use strict";
      module.exports = {
        OSD_ONLY: "0",
        AUTO_OSD: "1",
        AUTO_ONLY: "2",
        AUTO: "3",
        SINGLE_COLUMN: "4",
        SINGLE_BLOCK_VERT_TEXT: "5",
        SINGLE_BLOCK: "6",
        SINGLE_LINE: "7",
        SINGLE_WORD: "8",
        CIRCLE_WORD: "9",
        SINGLE_CHAR: "10",
        SPARSE_TEXT: "11",
        SPARSE_TEXT_OSD: "12",
        RAW_LINE: "13"
      };
    }
  });

  // node_modules/tesseract.js/src/index.js
  var require_src = __commonJS({
    "node_modules/tesseract.js/src/index.js"(exports, module) {
      "use strict";
      require_runtime();
      var createScheduler = require_createScheduler();
      var createWorker = require_createWorker();
      var Tesseract = require_Tesseract();
      var languages = require_languages();
      var OEM = require_OEM();
      var PSM = require_PSM();
      var { setLogging } = require_log();
      module.exports = {
        languages,
        OEM,
        PSM,
        createScheduler,
        createWorker,
        setLogging,
        ...Tesseract
      };
    }
  });

  // pii-detector.js
  var require_pii_detector = __commonJS({
    "pii-detector.js"(exports, module) {
      var EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
      var PHONE_INTL_REGEX = /(?:\+\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/g;
      var PHONE_CONTEXT_REGEX = /\b((?:phone|mobile|tel|cell|call(?:\s*me)?(?:\s*at)?|contact(?:\s*no|\s*number)?)[\s:=]+)([+\d\s().-]{7,20})\b/gi;
      var PASSWORD_REGEX = /\b((?:password|passwd|pwd|passcode|secret\s*phrase)[\s:=]+(?:is[\s:=]*)?)([^\s\r\n,;!]+)/gi;
      var OTP_REGEX = /\b((?:otp|one\s*time\s*(?:password|code|passcode)|verification\s*code|auth\s*code|security\s*code)[\s:=]+(?:is[\s:=]*)?)([0-9]{4,8})\b/gi;
      var PIN_REGEX = /\b((?:pin|security\s*pin|atm\s*pin|login\s*pin)[\s:=]+)([0-9]{4,8})\b/gi;
      var CREDENTIAL_USER_REGEX = /\b((?:login\s*id|credential\s*id|user\s*login|auth\s*user)[\s:=]+)([^\s\r\n,;!]{3,30})\b/gi;
      var CREDIT_CARD_GROUPED_REGEX = /\b(?:\d{4}[ -]){3}\d{4}\b|\b(?:\d{4}[ -]){2}\d{4}[ -]\d{1,4}\b/g;
      var CREDIT_CARD_CONTEXT_REGEX = /\b((?:credit\s*card|debit\s*card|card\s*number|card\s*no)[\s:=]+)(\d[\d\s-]{11,18}\d)\b/gi;
      var CVV_REGEX = /\b((?:cvv|cvc|cid|security\s*code|card\s*verification)[\s:=]+)([0-9]{3,4})\b/gi;
      var CARD_EXP_REGEX = /\b((?:exp(?:iry|iration)?(?:\s*date)?|valid\s*thru|valid\s*upto)[\s:=]+)((?:0[1-9]|1[0-2])[\/\-](?:\d{2}|\d{4}))\b/gi;
      var BANK_ACCOUNT_REGEX = /\b((?:bank\s*account(?:\s*no|\s*number)?|account\s*(?:no|number)|savings\s*account|current\s*account)[\s:=]+)(\d{8,18})\b/gi;
      var IFSC_REGEX = /\b(?:IFSC(?:\s*code)?[\s:=]+)?([A-Z]{4}0[A-Z0-9]{6})\b/g;
      var IBAN_REGEX = /\b([A-Z]{2}\d{2}[A-Z0-9]{4}[A-Z0-9]{7,26})\b/g;
      var SWIFT_BIC_REGEX = /\b(?:SWIFT|BIC)(?:[\s*code]*[\s:=]+)([A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)\b/gi;
      var ROUTING_SORT_REGEX = /\b((?:routing\s*(?:number|no)?|sort\s*code|aba\s*(?:number)?)[\s:=]+)(\d{9}|\d{2}-\d{2}-\d{2})\b/gi;
      var UPI_HANDLE_REGEX = /\b[\w.-]+@(?:okhdfcbank|okaxis|oksbi|okicici|paytm|apl|ybl|upi|barodampay|icici|axl|ibl|allbank|postbank|idfcbank|sbi)\b/gi;
      var UPI_CONTEXT_REGEX = /\b((?:upi(?:\s*id)?|payment\s*handle|vpa)[\s:=]+)([a-zA-Z0-9._-]+@[a-zA-Z0-9]+)\b/gi;
      var AADHAAR_CONTEXT_REGEX = /\b((?:aadhaar|adhaar|uidai|uid)[\s:=]+)(\d{4}[\s-]?\d{4}[\s-]?\d{4}|\d{12})\b/gi;
      var PAN_REGEX = /\b(?:PAN(?:\s*number|\s*card)?[\s:=]+)?([A-Z]{5}[0-9]{4}[A-Z])\b/g;
      var PASSPORT_REGEX = /\b((?:passport(?:\s*no|\s*number)?)[\s:=]+)([A-PR-WYa-pr-wy][1-9]\d\s?\d{4}[1-9]|[A-Z0-9]{7,9})\b/gi;
      var DRIVERS_LICENSE_REGEX = /\b((?:driver'?s?\s*license|dl(?:\s*no)?)[\s:=]+)([A-Z0-9\s\/-]{8,20})\b/gi;
      var SSN_REGEX = /\b((?:ssn|social\s*security(?:\s*number)?)[\s:=]+)?(\d{3}-\d{2}-\d{4})\b/gi;
      var EMPLOYEE_STUDENT_ID_REGEX = /\b((?:employee\s*id|emp\s*id|staff\s*id|student\s*id)[\s:=]+)([A-Za-z0-9\-]{4,15})\b/gi;
      var NATIONAL_ID_REGEX = /\b((?:national\s*id|tax\s*id|tin\s*no|voter\s*id)[\s:=]+)([A-Za-z0-9\/-]{6,16})\b/gi;
      var DOB_REGEX = /\b((?:dob|date\s*of\s*birth|birth\s*date)[\s:=]+)(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})\b/gi;
      var ADDRESS_REGEX = /\b((?:residential\s*address|home\s*address|personal\s*address)[\s:=]+)([^\r\n,;]{5,80})/gi;
      var EMERGENCY_CONTACT_REGEX = /\b((?:emergency\s*contact(?:\s*(?:name|number|phone))?)[\s:=]+)([^\r\n,;]{3,50})/gi;
      var MEDICAL_ID_REGEX = /\b((?:medical\s*record(?:\s*number)?|mrn|patient\s*id|health\s*insurance(?:\s*id|\s*number)?|policy\s*number|prescription\s*(?:id|no)|rx\s*number)[\s:=]+)([A-Za-z0-9\-]{4,20})\b/gi;
      var BEARER_TOKEN_REGEX = /\b((?:Authorization:\s*)?Bearer\s+)([A-Za-z0-9_\-\.]{20,})\b/gi;
      var JWT_REGEX = /\b(eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{10,})\b/g;
      var PRIVATE_KEY_REGEX = /-----BEGIN[ A-Z_-]*PRIVATE KEY-----[\s\S]*?-----END[ A-Z_-]*PRIVATE KEY-----/g;
      var API_KEY_PREFIX_REGEX = /\b(sk-[A-Za-z0-9]{20,})\b/g;
      var API_KEY_CONTEXT_REGEX = /\b((?:api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|session[_-]?token|refresh[_-]?token)[\s:=]+['"]?)([A-Za-z0-9_\-]{16,})(['"]?)/gi;
      var ENV_SECRET_REGEX = /\b((?:AWS_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID|GITHUB_TOKEN|OPENAI_API_KEY|GEMINI_API_KEY|DATABASE_URL)[\s:=]+['"]?)([^\s'"]{8,})(['"]?)/gi;
      var CREDIT_CARD_REGEX = CREDIT_CARD_GROUPED_REGEX;
      var PHONE_REGEX = PHONE_INTL_REGEX;
      function luhnCheck(numStr) {
        if (!numStr || typeof numStr !== "string") return false;
        const sanitized = numStr.replace(/[\s-]/g, "");
        if (!/^\d{13,19}$/.test(sanitized)) return false;
        let sum = 0;
        let shouldDouble = false;
        for (let i = sanitized.length - 1; i >= 0; i--) {
          let digit = parseInt(sanitized.charAt(i), 10);
          if (shouldDouble) {
            digit *= 2;
            if (digit > 9) digit -= 9;
          }
          sum += digit;
          shouldDouble = !shouldDouble;
        }
        return sum % 10 === 0;
      }
      var EXEMPTION_PATTERNS = [
        /\b(?:order\s*(?:id|number|no|code|#)?)[\s:=]+[A-Za-z0-9\-]+/gi,
        /\b(?:product\s*(?:id|code|no|number)?)[\s:=]+[A-Za-z0-9\-]+/gi,
        /\b(?:sku|item\s*(?:no|number|code))[\s:=]+[A-Za-z0-9\-]+/gi,
        /(?:₹|Rs\.?|INR|\$|€|£)\s*[\d,]+(?:\.\d{1,2})?/gi,
        /\b(?:price|cost|amount)[\s:=]+(?:₹|Rs\.?|INR|\$|€|£)?\s*[\d,]+(?:\.\d{1,2})?/gi,
        /\b(?:year|yr)[\s:=]+20\d{2}\b/gi,
        /\b(?:qty|quantity|count)[\s:=]+\d+\b/gi,
        /\b(?:search\s*query|query)[\s:=]+[^\r\n,;]+/gi,
        /\bkey\s+features\b/gi,
        /\bsecret\s+of\s+success\b/gi,
        /\btoken\s+ring\b/gi
      ];
      function redactText2(text) {
        if (!text || typeof text !== "string") {
          return "";
        }
        const exemptions = [];
        let maskedText = text;
        EXEMPTION_PATTERNS.forEach((pattern) => {
          maskedText = maskedText.replace(pattern, (match) => {
            if (/@/.test(match) || /password|cvv/i.test(match)) {
              return match;
            }
            const token = `__IRIS_EXEMPT_${exemptions.length}__`;
            exemptions.push({ token, original: match });
            return token;
          });
        });
        maskedText = maskedText.replace(PRIVATE_KEY_REGEX, "[REDACTED_PRIVATE_KEY]");
        maskedText = maskedText.replace(JWT_REGEX, "[REDACTED_JWT]");
        maskedText = maskedText.replace(BEARER_TOKEN_REGEX, "$1[REDACTED_TOKEN]");
        maskedText = maskedText.replace(API_KEY_PREFIX_REGEX, "[REDACTED_API_KEY]");
        maskedText = maskedText.replace(API_KEY_CONTEXT_REGEX, "$1[REDACTED_API_KEY]$3");
        maskedText = maskedText.replace(ENV_SECRET_REGEX, "$1[REDACTED_SECRET]$3");
        maskedText = maskedText.replace(PASSWORD_REGEX, "$1[REDACTED_PASSWORD]");
        maskedText = maskedText.replace(OTP_REGEX, "$1[REDACTED_OTP]");
        maskedText = maskedText.replace(PIN_REGEX, "$1[REDACTED_PASSWORD]");
        maskedText = maskedText.replace(CREDENTIAL_USER_REGEX, "$1[REDACTED_CREDENTIAL]");
        maskedText = maskedText.replace(CVV_REGEX, "$1[REDACTED_CVV]");
        maskedText = maskedText.replace(CARD_EXP_REGEX, "$1[REDACTED_CARD_EXP]");
        maskedText = maskedText.replace(CREDIT_CARD_CONTEXT_REGEX, "$1[REDACTED_CARD]");
        maskedText = maskedText.replace(CREDIT_CARD_GROUPED_REGEX, (match) => {
          const digitsOnly = match.replace(/[\s-]/g, "");
          if (digitsOnly.length >= 13 && digitsOnly.length <= 19) {
            if (luhnCheck(digitsOnly) || digitsOnly.length === 16) {
              return "[REDACTED_CARD]";
            }
          }
          return match;
        });
        maskedText = maskedText.replace(BANK_ACCOUNT_REGEX, "$1[REDACTED_BANK_ACCOUNT]");
        maskedText = maskedText.replace(IFSC_REGEX, "[REDACTED_IFSC]");
        maskedText = maskedText.replace(SWIFT_BIC_REGEX, "[REDACTED_BANK_ACCOUNT]");
        maskedText = maskedText.replace(ROUTING_SORT_REGEX, "$1[REDACTED_BANK_ACCOUNT]");
        maskedText = maskedText.replace(UPI_HANDLE_REGEX, "[REDACTED_UPI]");
        maskedText = maskedText.replace(UPI_CONTEXT_REGEX, "$1[REDACTED_UPI]");
        maskedText = maskedText.replace(IBAN_REGEX, (match) => {
          if (/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(match)) {
            return "[REDACTED_BANK_ACCOUNT]";
          }
          return match;
        });
        maskedText = maskedText.replace(AADHAAR_CONTEXT_REGEX, "$1[REDACTED_AADHAAR]");
        maskedText = maskedText.replace(PAN_REGEX, "[REDACTED_PAN]");
        maskedText = maskedText.replace(PASSPORT_REGEX, "$1[REDACTED_PASSPORT]");
        maskedText = maskedText.replace(DRIVERS_LICENSE_REGEX, "$1[REDACTED_ID]");
        maskedText = maskedText.replace(SSN_REGEX, (match, prefix, ssn) => {
          return prefix ? `${prefix}[REDACTED_ID]` : "[REDACTED_ID]";
        });
        maskedText = maskedText.replace(EMPLOYEE_STUDENT_ID_REGEX, "$1[REDACTED_ID]");
        maskedText = maskedText.replace(NATIONAL_ID_REGEX, "$1[REDACTED_ID]");
        maskedText = maskedText.replace(DOB_REGEX, "$1[REDACTED_DOB]");
        maskedText = maskedText.replace(ADDRESS_REGEX, "$1[REDACTED_ADDRESS]");
        maskedText = maskedText.replace(EMERGENCY_CONTACT_REGEX, "$1[REDACTED_CONTACT]");
        maskedText = maskedText.replace(MEDICAL_ID_REGEX, "$1[REDACTED_MEDICAL_ID]");
        maskedText = maskedText.replace(EMAIL_REGEX, "[REDACTED_EMAIL]");
        maskedText = maskedText.replace(PHONE_CONTEXT_REGEX, "$1[REDACTED_PHONE]");
        maskedText = maskedText.replace(PHONE_INTL_REGEX, (match) => {
          const digitsOnly = match.replace(/\D/g, "");
          if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
            return "[REDACTED_PHONE]";
          }
          return match;
        });
        exemptions.forEach(({ token, original }) => {
          maskedText = maskedText.replace(token, original);
        });
        return maskedText;
      }
      function detectAndRedactSensitiveValue2(value) {
        if (!value || typeof value !== "string") {
          return { detected: false, redacted: "", categories: [] };
        }
        const redacted = redactText2(value);
        const detected = redacted !== value;
        const categories = [];
        if (detected) {
          if (redacted.includes("[REDACTED_EMAIL]")) categories.push("EMAIL");
          if (redacted.includes("[REDACTED_PHONE]")) categories.push("PHONE");
          if (redacted.includes("[REDACTED_PASSWORD]")) categories.push("PASSWORD");
          if (redacted.includes("[REDACTED_CARD]")) categories.push("CARD");
          if (redacted.includes("[REDACTED_CVV]")) categories.push("CVV");
          if (redacted.includes("[REDACTED_BANK_ACCOUNT]") || redacted.includes("[REDACTED_IFSC]") || redacted.includes("[REDACTED_UPI]")) categories.push("BANK");
          if (redacted.includes("[REDACTED_AADHAAR]") || redacted.includes("[REDACTED_PAN]") || redacted.includes("[REDACTED_PASSPORT]") || redacted.includes("[REDACTED_ID]")) categories.push("IDENTITY");
          if (redacted.includes("[REDACTED_TOKEN]") || redacted.includes("[REDACTED_JWT]") || redacted.includes("[REDACTED_API_KEY]") || redacted.includes("[REDACTED_SECRET]") || redacted.includes("[REDACTED_PRIVATE_KEY]")) categories.push("CREDENTIAL");
          if (redacted.includes("[REDACTED_DOB]") || redacted.includes("[REDACTED_ADDRESS]") || redacted.includes("[REDACTED_CONTACT]")) categories.push("PERSONAL");
          if (redacted.includes("[REDACTED_MEDICAL_ID]")) categories.push("HEALTH");
        }
        return {
          detected,
          redacted,
          categories
        };
      }
      function getCategoryCounts(text) {
        const counts = {
          EMAIL: 0,
          PHONE: 0,
          PASSWORD: 0,
          CARD: 0,
          BANK: 0,
          CREDENTIAL: 0,
          IDENTITY: 0,
          PERSONAL: 0,
          HEALTH: 0
        };
        if (!text || typeof text !== "string") {
          return counts;
        }
        const sanitized = redactText2(text);
        const countOccurrences = (target) => {
          let count = 0;
          let pos = sanitized.indexOf(target);
          while (pos !== -1) {
            count++;
            pos = sanitized.indexOf(target, pos + target.length);
          }
          return count;
        };
        counts.EMAIL += countOccurrences("[REDACTED_EMAIL]");
        counts.PHONE += countOccurrences("[REDACTED_PHONE]");
        counts.PASSWORD += countOccurrences("[REDACTED_PASSWORD]") + countOccurrences("[REDACTED_OTP]");
        counts.CARD += countOccurrences("[REDACTED_CARD]") + countOccurrences("[REDACTED_CVV]") + countOccurrences("[REDACTED_CARD_EXP]");
        counts.BANK += countOccurrences("[REDACTED_BANK_ACCOUNT]") + countOccurrences("[REDACTED_IFSC]") + countOccurrences("[REDACTED_UPI]");
        counts.CREDENTIAL += countOccurrences("[REDACTED_TOKEN]") + countOccurrences("[REDACTED_JWT]") + countOccurrences("[REDACTED_API_KEY]") + countOccurrences("[REDACTED_SECRET]") + countOccurrences("[REDACTED_PRIVATE_KEY]") + countOccurrences("[REDACTED_CREDENTIAL]");
        counts.IDENTITY += countOccurrences("[REDACTED_AADHAAR]") + countOccurrences("[REDACTED_PAN]") + countOccurrences("[REDACTED_PASSPORT]") + countOccurrences("[REDACTED_ID]");
        counts.PERSONAL += countOccurrences("[REDACTED_DOB]") + countOccurrences("[REDACTED_ADDRESS]") + countOccurrences("[REDACTED_CONTACT]");
        counts.HEALTH += countOccurrences("[REDACTED_MEDICAL_ID]");
        return counts;
      }
      var SENSITIVE_INPUT_KEYWORDS = [
        "card",
        "credit",
        "debit",
        "cvv",
        "cvc",
        "cid",
        "ssn",
        "phone",
        "mobile",
        "password",
        "passwd",
        "pwd",
        "passcode",
        "email",
        "bank",
        "account",
        "iban",
        "ifsc",
        "swift",
        "routing",
        "aadhaar",
        "adhaar",
        "pan",
        "passport",
        "dob",
        "birth",
        "patient",
        "medical",
        "secret",
        "token",
        "api_key",
        "apikey",
        "otp",
        "pin",
        "auth",
        "credential"
      ];
      var SENSITIVE_AUTOCOMPLETE_VALUES = [
        "current-password",
        "new-password",
        "one-time-code",
        "cc-number",
        "cc-csc",
        "cc-exp",
        "cc-exp-month",
        "cc-exp-year",
        "cc-type",
        "cc-name",
        "email",
        "tel",
        "bday",
        "bday-day",
        "bday-month",
        "bday-year",
        "street-address",
        "postal-code",
        "transaction-amount"
      ];
      function isSensitiveInputMetadata(metadata) {
        if (!metadata || typeof metadata !== "object") return false;
        const type = (metadata.type || "").toLowerCase();
        const name = (metadata.name || "").toLowerCase();
        const id = (metadata.id || "").toLowerCase();
        const placeholder = (metadata.placeholder || "").toLowerCase();
        const autocomplete = (metadata.autocomplete || "").toLowerCase();
        const ariaLabel = (metadata.ariaLabel || "").toLowerCase();
        const labelText = (metadata.labelText || "").toLowerCase();
        if (type === "password" || type === "email" || type === "tel") {
          return true;
        }
        if (autocomplete) {
          if (SENSITIVE_AUTOCOMPLETE_VALUES.some((v) => autocomplete.includes(v))) {
            return true;
          }
        }
        const combined = `${name} ${id} ${placeholder} ${ariaLabel} ${labelText}`.toLowerCase();
        const hasExemptWord = combined.includes("order") || combined.includes("product") || combined.includes("search") || combined.includes("quantity");
        const hasHighSensitivityWord = combined.includes("password") || combined.includes("card") || combined.includes("cvv") || combined.includes("pin") || combined.includes("account");
        if (hasExemptWord && !hasHighSensitivityWord) {
          return false;
        }
        return SENSITIVE_INPUT_KEYWORDS.some((kw) => combined.includes(kw));
      }
      if (typeof window !== "undefined") {
        window.redactText = redactText2;
        window.detectAndRedactSensitiveValue = detectAndRedactSensitiveValue2;
        window.getCategoryCounts = getCategoryCounts;
        window.isSensitiveInputMetadata = isSensitiveInputMetadata;
        window.luhnCheck = luhnCheck;
      }
      if (typeof globalThis !== "undefined") {
        globalThis.redactText = redactText2;
        globalThis.detectAndRedactSensitiveValue = detectAndRedactSensitiveValue2;
        globalThis.getCategoryCounts = getCategoryCounts;
        globalThis.isSensitiveInputMetadata = isSensitiveInputMetadata;
        globalThis.luhnCheck = luhnCheck;
      }
      if (typeof module !== "undefined" && module.exports) {
        module.exports = {
          redactText: redactText2,
          detectAndRedactSensitiveValue: detectAndRedactSensitiveValue2,
          getCategoryCounts,
          isSensitiveInputMetadata,
          luhnCheck,
          PASSWORD_REGEX,
          CREDIT_CARD_REGEX,
          PHONE_REGEX,
          EMAIL_REGEX
        };
      }
    }
  });

  // ocr-entry.js
  var require_ocr_entry = __commonJS({
    "ocr-entry.js"(exports, module) {
      var { createWorker } = require_src();
      var ocrWorkerInstance = null;
      var ocrWorkerInitPromise = null;
      var lastInitDurationMs = null;
      async function getOcrWorker() {
        if (ocrWorkerInstance) {
          return ocrWorkerInstance;
        }
        if (ocrWorkerInitPromise) {
          return ocrWorkerInitPromise;
        }
        ocrWorkerInitPromise = (async () => {
          const t0 = performance.now();
          const workerPath = chrome.runtime.getURL("lib/ocr/worker.min.js");
          const corePath = chrome.runtime.getURL("lib/ocr");
          const langPath = chrome.runtime.getURL("lib/ocr");
          const worker = await createWorker("eng", 1, {
            workerPath,
            corePath,
            langPath,
            gzip: true,
            workerBlobURL: false,
            // Required for Manifest V3 extension CSP compatibility
            logger: () => {
            }
            // Silent
          });
          lastInitDurationMs = Math.round(performance.now() - t0);
          ocrWorkerInstance = worker;
          ocrWorkerInitPromise = null;
          return ocrWorkerInstance;
        })();
        return ocrWorkerInitPromise;
      }
      function prepareScreenshotImage(dataUrl, maxDim = 1600) {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const origW = img.naturalWidth || img.width;
            const origH = img.naturalHeight || img.height;
            if (!origW || !origH) {
              return reject(new Error("Invalid screenshot dimensions"));
            }
            let targetW = origW;
            let targetH = origH;
            let scale = 1;
            if (Math.max(origW, origH) > maxDim) {
              scale = maxDim / Math.max(origW, origH);
              targetW = Math.round(origW * scale);
              targetH = Math.round(origH * scale);
            }
            const canvas = document.createElement("canvas");
            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              return reject(new Error("Unable to create canvas 2D context"));
            }
            ctx.drawImage(img, 0, 0, targetW, targetH);
            resolve({
              canvas,
              origW,
              origH,
              targetW,
              targetH,
              scaleX: origW / targetW,
              scaleY: origH / targetH,
              scale
            });
          };
          img.onerror = () => reject(new Error("Failed to load screenshot image for OCR"));
          img.src = dataUrl;
        });
      }
      async function runOcr(screenshotDataUrl) {
        try {
          if (!screenshotDataUrl || typeof screenshotDataUrl !== "string" || !screenshotDataUrl.startsWith("data:image/")) {
            return {
              success: false,
              reason: "Invalid screenshot data URL",
              words: [],
              lines: [],
              initTimeMs: 0,
              inferenceTimeMs: 0
            };
          }
          const tInit0 = performance.now();
          const worker = await getOcrWorker();
          const initTimeMs = lastInitDurationMs !== null ? lastInitDurationMs : Math.round(performance.now() - tInit0);
          const { canvas, origW, origH, scaleX, scaleY, scale } = await prepareScreenshotImage(screenshotDataUrl, 1600);
          const tInfer0 = performance.now();
          const recognition = await worker.recognize(canvas);
          const inferenceTimeMs = Math.round(performance.now() - tInfer0);
          const data = recognition && recognition.data ? recognition.data : {};
          const rawWords = data.words || [];
          const rawLines = data.lines || [];
          const mappedWords = rawWords.map((w) => {
            const bbox = w.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 };
            const x = Math.round(bbox.x0 * scaleX);
            const y = Math.round(bbox.y0 * scaleY);
            const width = Math.round((bbox.x1 - bbox.x0) * scaleX);
            const height = Math.round((bbox.y1 - bbox.y0) * scaleY);
            return {
              text: (w.text || "").trim(),
              x,
              y,
              width,
              height,
              confidence: w.confidence || 0
            };
          }).filter((w) => w.text.length > 0 && w.width > 0 && w.height > 0);
          const mappedLines = rawLines.map((l) => {
            const bbox = l.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 };
            const x = Math.round(bbox.x0 * scaleX);
            const y = Math.round(bbox.y0 * scaleY);
            const width = Math.round((bbox.x1 - bbox.x0) * scaleX);
            const height = Math.round((bbox.y1 - bbox.y0) * scaleY);
            const words = (l.words || []).map((w) => {
              const wb = w.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 };
              return {
                text: (w.text || "").trim(),
                x: Math.round(wb.x0 * scaleX),
                y: Math.round(wb.y0 * scaleY),
                width: Math.round((wb.x1 - wb.x0) * scaleX),
                height: Math.round((wb.y1 - wb.y0) * scaleY),
                confidence: w.confidence || 0
              };
            }).filter((w) => w.text.length > 0);
            return {
              text: (l.text || "").trim(),
              x,
              y,
              width,
              height,
              words
            };
          }).filter((l) => l.text.length > 0 && l.width > 0 && l.height > 0);
          return {
            success: true,
            words: mappedWords,
            lines: mappedLines,
            initTimeMs,
            inferenceTimeMs,
            scaleFactor: scale,
            screenshotDimensions: { width: origW, height: origH }
          };
        } catch (err) {
          return {
            success: false,
            reason: err.message || "OCR recognition failed",
            words: [],
            lines: [],
            initTimeMs: 0,
            inferenceTimeMs: 0
          };
        }
      }
      function inspectTextSensitivity(text) {
        if (!text || typeof text !== "string") {
          return { sensitive: false, category: null };
        }
        let result = null;
        if (typeof detectAndRedactSensitiveValue === "function") {
          result = detectAndRedactSensitiveValue(text);
        } else if (typeof window !== "undefined" && typeof window.detectAndRedactSensitiveValue === "function") {
          result = window.detectAndRedactSensitiveValue(text);
        } else if (typeof globalThis !== "undefined" && typeof globalThis.detectAndRedactSensitiveValue === "function") {
          result = globalThis.detectAndRedactSensitiveValue(text);
        } else if (typeof redactText === "function") {
          const red = redactText(text);
          result = { detected: red !== text, redacted: red, categories: [] };
        } else if (typeof window !== "undefined" && typeof window.redactText === "function") {
          const red = window.redactText(text);
          result = { detected: red !== text, redacted: red, categories: [] };
        } else if (typeof __require === "function") {
          try {
            const pii = require_pii_detector();
            if (pii && typeof pii.detectAndRedactSensitiveValue === "function") {
              result = pii.detectAndRedactSensitiveValue(text);
            }
          } catch (_) {
          }
        }
        if (result && result.detected) {
          const cat = result.categories && result.categories[0] ? result.categories[0] : "SENSITIVE";
          return { sensitive: true, category: cat };
        }
        return { sensitive: false, category: null };
      }
      function detectSensitiveOcrRegions(ocrData) {
        const regions = [];
        if (!ocrData) return regions;
        const words = Array.isArray(ocrData) ? ocrData : ocrData.words || [];
        const lines = Array.isArray(ocrData.lines) ? ocrData.lines : [];
        const matchedWordIndices = /* @__PURE__ */ new Set();
        lines.forEach((line) => {
          if (!line || !line.text) return;
          const lineInspection = inspectTextSensitivity(line.text);
          if (lineInspection.sensitive) {
            const lineWords = Array.isArray(line.words) ? line.words : [];
            let matchedSlice = false;
            for (let len = lineWords.length; len >= 1; len--) {
              for (let i = 0; i <= lineWords.length - len; i++) {
                const slice = lineWords.slice(i, i + len);
                const sliceText = slice.map((w) => w.text).join(" ");
                const sliceInspection = inspectTextSensitivity(sliceText);
                if (sliceInspection.sensitive) {
                  const minX = Math.min(...slice.map((w) => w.x));
                  const minY = Math.min(...slice.map((w) => w.y));
                  const maxX = Math.max(...slice.map((w) => w.x + w.width));
                  const maxY = Math.max(...slice.map((w) => w.y + w.height));
                  regions.push({
                    x: minX,
                    y: minY,
                    width: maxX - minX,
                    height: maxY - minY,
                    source: "ocr",
                    category: sliceInspection.category || lineInspection.category || "SENSITIVE",
                    scaled: true
                  });
                  slice.forEach((_, idx) => matchedWordIndices.add(i + idx));
                  matchedSlice = true;
                }
              }
            }
            if (!matchedSlice && line.width > 0 && line.height > 0) {
              regions.push({
                x: line.x,
                y: line.y,
                width: line.width,
                height: line.height,
                source: "ocr",
                category: lineInspection.category || "SENSITIVE",
                scaled: true
              });
            }
          }
        });
        words.forEach((w) => {
          if (w && w.text) {
            const wordInspection = inspectTextSensitivity(w.text);
            if (wordInspection.sensitive) {
              regions.push({
                x: w.x,
                y: w.y,
                width: w.width,
                height: w.height,
                source: "ocr",
                category: wordInspection.category || "SENSITIVE",
                scaled: true
              });
            }
          }
        });
        return regions;
      }
      if (typeof window !== "undefined") {
        window.SIHOCR = {
          getOcrWorker,
          runOcr,
          detectSensitiveOcrRegions
        };
        window.runOcr = runOcr;
        window.detectSensitiveOcrRegions = detectSensitiveOcrRegions;
      }
      if (typeof module !== "undefined" && module.exports) {
        module.exports = {
          getOcrWorker,
          runOcr,
          detectSensitiveOcrRegions
        };
      }
    }
  });
  require_ocr_entry();
})();
