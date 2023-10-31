
// Design goals for queuePromise, which were achieved
//   1. clients may queue promises in a global singleton queue, such that the N'th promise queued doesn't start executing until the N-1'th promise settles.
//   1b. if the N-1'th promise rejects, the N'th promise begins executing (rejections do not stall the queue).
//   2. the promise queue is scoped to a key passed by the client. One global singleton queue per key.
//   3. each promise within the same queue may have its own unique and/or distinct strongly typed promise result, without any unsafe casting.
//   4. when a client queues a promise by passing a thunk, the promise returned from this queuing operation settles as soon as the thunk's  resolves with the strongly typed result or rejects with the error of that thunk's promise as soon as the thunk finishes executing. A queued promise's settlement does not wait for any subsequent promises queued behind this promise.

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- here `any` is actually what we want, as the concrete type of each promise is known by each queuePromise invocation but needn't and can't be known by the singleton promise queue
const mostRecentPromiseInProgressPerKey: { [key: string]: Promise<any> } = {};

// queuePromise helps you queue promises back-to-back, so the next
// promise doesn't start executing until the previous one settles.
// queuePromise queues the promise returned by the passed thunk into a
// global singleton queue for the passed key. The thunk isn't called
// until it's the head of the queue. Ie. the thunk's returned promise is
// not instantiated and does not begin execution until any prior queued
// promises have settled. The promise returned by queuePromise settles
// with the same fulfillment or rejection value as the thunk's returned
// promise, however, WARNING the promise returned by queuePromise is a
// synthetic promise used to help manage queueing and is not the same
// promise returned by the thunk. The promise returned by queuePromise
// settles as soon as the thunk's promise settles, without waiting for
// subsequent queued promises to settle.
export async function queuePromise<T>(key: string, thunk: () => Promise<T>/*, description?: string*/): Promise<T> {
  const mrp = mostRecentPromiseInProgressPerKey[key];
  const p: Promise<T> = new Promise<void>((resolve) => resolve()) // WARNING the first parameter of the Promise constructor is executed immediately by the Promise during construction (https://stackoverflow.com/questions/42118900/when-is-the-body-of-a-promise-constructor-callback-executed/42118995#42118995) and so, this initial promise with a no-op resolve() is needed to ensure that the first substantive promise in our promise chain is not executed until queuePromise finishes setting up the queueing. If we were to remove this no-op promise, then we'd introduce a concurrency bug where the first substantive promise in our promise chain executes when this promise `p` is constructed and before queuePromise ends, which breaks queueing because when the `await` statement is encountered in the first substantive promise, the JS runtime will suspend execution of this initial queuePromise invocation, and then subsequent queuePromise invocations may occur before the first queuePromise invocation finishes queueing. Ie. if this bug is introduced by removing the needed no-op promise, then the `mrp` variable for a subsequent queuePromise may not actually contain this queuePromise invocation's `p` because this invocation of queuePromise was suspended when hitting the first `await` below, so `mostRecentPromiseInProgressPerKey[key] = p;` may not have been assigned before the next invocation of queuePromise.
    .then(async () => {
      await new Promise<void>((resolve) => {
        if (mrp) {
          // console.log("not first in queue, deferring execution", description);
          mrp.finally(() => { // there's a promise ahead of the new promise in the queue for this key, so we won't begin executing the new promise until the existing promise settles
            // console.log("now executing", description);
            resolve();
          }).catch(() => { }); // WARNING here we must add a no-op catch handler because mrp.finally() creates a new promise chain, and so if mrp rejects without a catch handler, we'll see a global error like `Uncaught (in promise)`. The no-op catch handler is correct because for this promise being queued, we don't care whether the previous promise ends up fulfilled or rejected, we only care to defer execution of this promise until the previous promise settles. mrp's fulfillment or rejection value will be handled by the queuePromise client that queued mrp's thunk.
        }
        else { // the new promise is only one in the queue for this key, so we'll begin executing it immediately
          // console.log("first in queue, executing", description);
          resolve();
        }
      })
    }).then(async () => {
      // console.log("do execution", description);
      const r = await thunk();
      // console.log("done execution", description);
      return r;
    }).finally(() => {
      if (mostRecentPromiseInProgressPerKey[key] === p) {
        // console.log("done executing, queue empty", description);
        delete mostRecentPromiseInProgressPerKey[key];
      } else {
        // console.log("done executing, queue not empty", description);
      }
    });
  mostRecentPromiseInProgressPerKey[key] = p;
  // console.log("queued", description, `${mrp === undefined ? 'was first' : 'not first'}`);
  return p;
}

// queuePromise tests that output 0..9 if passing

// queuePromise("test", () => new Promise((_resolve, reject) => {
//   console.log(0);
//   reject("error2");
// })).catch(() => console.log(0.5)); // this catch handler is executed synchronously when error is thrown because there's no new promises instantiated or `await` between the throw and this catch

// queuePromise("test", async () => {
//   console.log(1);
// }/*, "1"*/).then(() => queuePromise("test", async () => console.log(8)/*, "8"*/));

// queuePromise("test", async () => {
//   console.log(2);
// }/*, "2"*/);

// queuePromise("test", async () => {
//   console.log(3);
//   throw "error3";
// }/*, "3"*/).catch(() => console.log(4)); // this catch handler is executed synchronously when error is thrown because there's no new promises instantiated or `await` between the throw and this catch

// queuePromise("test", async () => {
//   console.log(5);
//   throw "error4";
// }/*, "5"*/).catch(() => console.log(6));  // this catch handler is executed synchronously when error is thrown because there's no new promises instantiated or `await` between the throw and this catch

// queuePromise("test", async () => {
//   console.log(7);
// }/*, "7"*/).then(() => queuePromise("test", async () => console.log(9)/*, "9"*/));
