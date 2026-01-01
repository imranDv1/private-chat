import { NextRequest, NextResponse } from "next/server"
import { redis } from "./lib/redis"
import { nanoid } from "nanoid"

export const proxy = async (req: NextRequest) => {
  const pathname = req.nextUrl.pathname
  const roomMatch = pathname.match(/^\/room\/([^/]+)$/)
  
  if (!roomMatch) return NextResponse.redirect(new URL("/", req.url))

  const roomId = roomMatch[1]
  const meta = await redis.hgetall<{ connected: string[]; createdAt: number }>(
    `meta:${roomId}`
  )

  if (!meta) {
    return NextResponse.redirect(new URL("/?error=room-not-found", req.url))
  }

  const existingToken = req.cookies.get("x-auth-token")?.value

  // 1. Check if user is already registered in this room
  if (existingToken && meta.connected.includes(existingToken)) {
    return NextResponse.next()
  }

  // 2. Updated Limit: Check if the room is full (Allowing 3 users)
  // Changed from >= 2 to >= 3
  if (meta.connected.length >= 3) {
    return NextResponse.redirect(new URL("/?error=room-full", req.url))
  }

  // 3. New User Setup
  const response = NextResponse.next()
  const token = nanoid()

  response.cookies.set("x-auth-token", token, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  })

  // 4. Update Redis
  // Note: In a production app with high traffic, consider using 
  // redis.eval with a Lua script to ensure this update is atomic.
  await redis.hset(`meta:${roomId}`, {
    ...meta, // Keep existing fields like createdAt
    connected: [...meta.connected, token],
  })

  return response
}

export const config = {
  matcher: "/room/:path*",
}