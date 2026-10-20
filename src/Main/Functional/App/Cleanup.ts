/** Attempts every ordered cleanup step, then reports all failures together. */
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
