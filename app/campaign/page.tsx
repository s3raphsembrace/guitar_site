"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type SongItem = {
    id: string;
    title: string;
    subtitle?: string;
    chartPath?: string;
};

type SongCompletion = {
    songId: string;
    grade: string;
    score: number;
    completedAt: string;
};

const SONGS: SongItem[] = [
    { id: "g_scale", title: "G Scale", chartPath: "/audio/charts/g_scale.json" },
    { id: "c_major_scale", title: "C Scale", chartPath: "/audio/charts/c_major_scale.json" },
    { id: "apollo_brown_butter", title: "Butter — Apollo Brown", chartPath: "/audio/charts/apollo_brown_butter.json" },
];

const GRADE_ORDER = { "S": 5, "A": 4, "B": 3, "C": 2, "D": 1, "F": 0 };

export default function CampaignPage() {
    const router = useRouter();
    const [completions, setCompletions] = useState<Record<string, SongCompletion>>({});
    const [loading, setLoading] = useState(true);

    // Fetch completion history from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem("campaign_completions");
            if (stored) {
                const data = JSON.parse(stored);
                setCompletions(data);
            }
        } catch (error) {
            console.error("[CAMPAIGN] Error loading completions:", error);
        }
        setLoading(false);
    }, []);

    const handlePlay = async (song: SongItem) => {
        // Navigate to game - the game will handle grade tracking
        router.push(`/game/${song.id}?campaign=true`);
    };

    const isUnlocked = (index: number): boolean => {
        if (index === 0) return true; // First song always unlocked
        
        const prevSong = SONGS[index - 1];
        const prevCompletion = completions[prevSong.id];
        
        if (!prevCompletion) return false;
        
        // Check if grade is A or above
        const gradeValue = GRADE_ORDER[prevCompletion.grade as keyof typeof GRADE_ORDER] || 0;
        return gradeValue >= GRADE_ORDER["A"];
    };

    const getGradeColor = (grade: string): string => {
        switch (grade) {
            case "S":
                return "text-yellow-400";
            case "A":
                return "text-green-400";
            case "B":
                return "text-blue-400";
            case "C":
                return "text-purple-400";
            case "D":
                return "text-orange-400";
            case "F":
                return "text-red-400";
            default:
                return "text-gray-400";
        }
    };

    if (loading) {
        return (
            <main className="max-w-4xl mx-auto p-6">
                <h1 className="text-3xl font-bold text-white mb-4">Campaign</h1>
                <p className="text-gray-300">Loading...</p>
            </main>
        );
    }

    return (
        <main className="max-w-4xl mx-auto p-6">
            <h1 className="text-3xl font-bold text-white mb-4">Campaign</h1>
            <p className="text-gray-300 mb-6">Play through the songs in order. You must get an A or above to unlock the next song.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {SONGS.map((s, i) => {
                    const completion = completions[s.id];
                    const locked = !isUnlocked(i);
                    const gradeValue = completion ? GRADE_ORDER[completion.grade as keyof typeof GRADE_ORDER] || 0 : 0;
                    const passedRequirement = gradeValue >= GRADE_ORDER["A"];

                    return (
                        <div
                            key={s.id}
                            className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-gray-600 transition-colors"
                        >
                            <div className="flex flex-col h-full">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-lg font-semibold text-white">{s.title}</h3>
                                        {s.subtitle && <p className="text-sm text-gray-400">{s.subtitle}</p>}
                                    </div>
                                    {locked && (
                                        <div className="text-2xl">🔒</div>
                                    )}
                                </div>

                                {/* Status */}
                                <div className="flex-1 flex items-center justify-center mb-6">
                                    <div className={`w-full h-32 rounded-md border-2 border-dashed flex items-center justify-center transition-colors ${
                                        locked
                                            ? "border-gray-600 bg-gray-900/50"
                                            : completion
                                            ? "border-green-600 bg-green-900/20"
                                            : "border-gray-600 bg-gray-900/50"
                                    }`}>
                                        {locked ? (
                                            <div className="text-center">
                                                <div className="text-gray-500 text-sm">Locked</div>
                                                <div className="text-gray-600 text-xs mt-1">Complete previous song with A+</div>
                                            </div>
                                        ) : completion ? (
                                            <div className="text-center">
                                                <div className={`text-4xl font-bold ${getGradeColor(completion.grade)}`}>
                                                    {completion.grade}
                                                </div>
                                                <div className="text-gray-300 text-xs mt-1">Score: {completion.score}</div>
                                            </div>
                                        ) : (
                                            <div className="text-gray-300 text-sm">Ready to play</div>
                                        )}
                                    </div>
                                </div>

                                {/* Play Button */}
                                <button
                                    onClick={() => handlePlay(s)}
                                    disabled={locked}
                                    className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${
                                        locked
                                            ? "bg-gray-700 text-gray-500 cursor-not-allowed opacity-60"
                                            : completion && passedRequirement
                                            ? "bg-green-600 hover:bg-green-700 text-white"
                                            : completion
                                            ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                                            : "bg-blue-600 hover:bg-blue-700 text-white"
                                    }`}
                                >
                                    {locked ? "Locked" : completion ? completion.grade >= "A" ? "Replay" : "Retry" : "Play"}
                                </button>

                                {completion && !passedRequirement && (
                                    <div className="mt-3 p-2 bg-red-900/30 border border-red-700 rounded text-red-200 text-xs text-center">
                                        Need A or above to unlock next song
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </main>
    );
}

