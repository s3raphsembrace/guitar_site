"use client";
import { useEffect, useRef } from "react";
// npm install socket.io-client
// import { io, Socket } from "socket.io-client";

export function useSocket(roomCode: string | null) {
  const socketRef = useRef<unknown>(null);

  useEffect(() => {
    if (!roomCode) return;
    // const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "");
    // socketRef.current = socket;
    // return () => { socket.disconnect(); };
  }, [roomCode]);

  return socketRef;
}
