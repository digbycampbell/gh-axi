/** Read all of this process's stdin as a UTF-8 string. */
export declare function readStdin(): Promise<string>;
/** Whether stdin is an interactive terminal (no piped input available). */
export declare function isStdinTTY(): boolean;
