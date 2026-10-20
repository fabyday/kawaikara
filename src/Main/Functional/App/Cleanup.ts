/**
 * Attempts every cleanup step in order and reports failures after all steps finish.
 *
 * @param steps - Synchronous or asynchronous teardown operations in dependency order.
 * Each operation is awaited before the next begins.
 * @returns A promise fulfilled only when all steps have completed successfully.
 * @throws An AggregateError containing every thrown/rejected error, after remaining
 * steps have also been attempted.
 * @remarks This helper does not make individual operations idempotent. Owners must
 * provide their own guards when cleanup can be requested more than once.
 */
export async function completeCleanup(
    steps: readonly (() => void | Promise<void>)[],
): Promise<void> {
    const errors: unknown[] = [];
    for (const step of steps) {
        try {
            await step();
        } catch (error) {
            errors.push(error);
        }
    }
    if (errors.length)
        throw new AggregateError(errors, 'Application cleanup failed.');
}
