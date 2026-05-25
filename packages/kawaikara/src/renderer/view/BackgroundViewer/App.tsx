import type { FC } from 'react';

const App: FC = () => {
    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
            <main className="w-full max-w-4xl px-8">
                <p className="text-sm font-medium uppercase tracking-wide text-cyan-300">
                    Kawaikara
                </p>
                <h1 className="mt-3 text-3xl font-semibold">
                    Background Viewer
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300">
                    Kawaikara workspace
                </p>
            </main>
        </div>
    );
};
export default App;
