import { NextRequest, NextResponse } from "next/server"
import { redis } from "./lib/redis"
import { nanoid } from "nanoid"

type RoomMeta = {
  connected: string[]
  createdAt: number
}

export const proxy = async (req: NextRequest) => {
  const pathname = req.nextUrl.pathname

  const roomMatch = pathname.match(/^\/room\/([^/]+)$/)
  if (!roomMatch) {
    return NextResponse.redirect(new URL("/", req.url))
  }

  const roomId = roomMatch[1]

  // ===== جلب البيانات الخام من Redis =====
  const rawMeta = await redis.hgetall<Record<string, string>>(
    `meta:${roomId}`
  )

  if (!rawMeta || Object.keys(rawMeta).length === 0) {
    return NextResponse.redirect(
      new URL("/?error=room-not-found", req.url)
    )
  }

  // ===== تحويل القيم للأنواع الصحيحة =====
  const meta: RoomMeta = {
    connected: rawMeta.connected
      ? JSON.parse(rawMeta.connected)
      : [],
    createdAt: Number(rawMeta.createdAt),
  }

  const existingToken = req.cookies.get("x-auth-token")?.value

  // ===== المستخدم موجود مسبقًا =====
  if (existingToken && meta.connected.includes(existingToken)) {
    return NextResponse.next()
  }

  // ===== الغرفة ممتلئة =====
  if (meta.connected.length >= 2) {
    return NextResponse.redirect(
      new URL("/?error=room-full", req.url)
    )
  }

  // ===== السماح بالدخول =====
  const response = NextResponse.next()
  const token = nanoid()

  response.cookies.set("x-auth-token", token, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  })

  // ===== تحديث Redis بشكل صحيح =====
  await redis.hset(`meta:${roomId}`, {
    connected: JSON.stringify([...meta.connected, token]),
  })

  return response
}

export const config = {
  matcher: "/room/:path*",
}
