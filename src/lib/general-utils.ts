export function scrub(obj: any, redactKeys: string[]) {
    const newObj = { ...obj };

    for (let key in newObj) {
        if (redactKeys.some(s => key.toLowerCase().includes(s))) {
            newObj[key] = "[REDACTED]";
        }
    };
    return newObj;
};

export function truncateData(data: any, limit?: number) {
    const LIMIT = limit ?? 8000;

    // If it's already a string (like HTML), slice it
    if (typeof data === 'string') {
        return data.length > LIMIT
            ? data.slice(0, LIMIT) + "\n[NOTICE: HTML truncated for analysis]"
            : data;
    }

    // If it's an object/array, stringify it
    const stringified = JSON.stringify(data);

    if (stringified.length > LIMIT) {
        return stringified.slice(0, LIMIT) +
            `\n[WARNING: JSON body truncated. Only the first ${LIMIT} characters were sent for analysis]`;
    }

    try {
        const parsed = JSON.parse(stringified)
        return parsed
    } catch { return {} };
};
