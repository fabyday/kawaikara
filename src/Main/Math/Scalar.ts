/**
 * Bounds a numeric value to an inclusive interval without rounding it.
 *
 * @param value - Number to constrain; infinities resolve to the corresponding bound.
 * @param minimum - Inclusive lower bound; must be less than or equal to maximum.
 * @param maximum - Inclusive upper bound.
 * @returns The bounded value, preserving fractions. NaN inputs propagate as NaN.
 * @remarks Bounds are not reordered or validated. Callers own input validation,
 * fallback values and any integer rounding required by their feature.
 */
export function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Linearly interpolates or extrapolates between two numbers.
 *
 * @param start - Value at progress 0.
 * @param end - Value at progress 1.
 * @param progress - Interpolation factor; values outside [0, 1] extrapolate.
 * @returns The unrounded result of start + (end - start) * progress.
 * @remarks This function does not clamp progress or sanitize non-finite values.
 */
export function lerp(start: number, end: number, progress: number): number {
    return start + (end - start) * progress;
}
