import { IExecutor } from './Executor';
import ITask from './Task';

export default async function run(executor: IExecutor, queue: AsyncIterable<ITask>, maxThreads = 0) {
   const runningTasks: Map<number, Promise<void>> = new Map();
   const waitingTasks: ITask[] = [];
   let isProcessing = false;
   let runningPromises = 0;
   async function processTask(task: ITask): Promise<void> {
      try {
         await executor.executeTask(task);
      } finally {
         runningTasks.delete(task.targetId);
         runningPromises--;
         await processNextTask();
      }
   }
   async function processNextTask(): Promise<void> {
      if (isProcessing && waitingTasks.length === 0) {
         return;
      }
      isProcessing = true;
      const task = waitingTasks.shift();
      if (task) {
         if (await runningTasks.get(task.targetId) !== undefined) {
            await runningTasks.get(task.targetId);
            await processNextTask();
         } else {
            const promise = processTask(task);
            runningTasks.set(task.targetId, promise);
            if (maxThreads === 0 || runningPromises < maxThreads || runningTasks.size === 0) {
               runningPromises++;
               await promise;
               await processNextTask();
            }
         }
      }
      isProcessing = false;
   }
   const iterator = queue[Symbol.asyncIterator]();
   while (true) {
      const { done, value: task } = await iterator.next();
      if (done) {
         if (!isProcessing) {
            console.log(runningTasks.values())
            await Promise.all(runningTasks.values());
         }
         if (runningTasks.size === 0) {
            break;
         }
      } else {
         waitingTasks.push(task);
         if (!isProcessing) {
            await  processNextTask();
         }
      }
   }
}