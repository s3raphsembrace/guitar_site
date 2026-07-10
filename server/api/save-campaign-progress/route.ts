import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        const { songId, grade, score } = await req.json();

        if (!songId || !grade) {
            return NextResponse.json(
                { success: false, message: "Missing required fields" },
                { status: 400 }
            );
        }

        // Store in localStorage via client-side call
        // This endpoint primarily for validation
        return NextResponse.json({ 
            success: true, 
            message: "Campaign progress tracked",
            data: {
                songId,
                grade,
                score,
                completedAt: new Date().toISOString(),
                userId: session?.user?.id
            }
        });

        // Add this to your game end/score submission logic
        const saveCampaignProgress = (songId: string, grade: string, score: number) => {
            try {
                const completion = {
                    songId,
                    grade,
                    score,
                    completedAt: new Date().toISOString()
                };

                const stored = localStorage.getItem("campaign_completions") || "{}";
                const completions = JSON.parse(stored);
                completions[songId] = completion;
                localStorage.setItem("campaign_completions", JSON.stringify(completions));

                console.log("[CAMPAIGN] Saved progress:", completion);
            } catch (error) {
                console.error("[CAMPAIGN] Error saving progress:", error);
            }
        };

        // Call this when the game ends with the player's grade
        saveCampaignProgress(songId, grade, score);
    } catch (error) {
        console.error("[CAMPAIGN_PROGRESS] Error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to save progress" },
            { status: 500 }
        );
    }
}