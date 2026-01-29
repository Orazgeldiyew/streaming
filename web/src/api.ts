export type JoinResponse = {
  room: string;
  name: string;
  role: "teacher" | "student";
  token: string;
  wsUrl: string;
};

const API_URL = "/api/v1/livekit/join";
const API_SECRET = "secret123";

// ✅ teacher выдаём только если teacherKey задан
export async function fetchJoin(
  room: string,
  name: string,
  role: "teacher" | "student",
  teacherKey?: string
): Promise<JoinResponse> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": API_SECRET,
    },
    body: JSON.stringify({
      room,
      name,
      role,
      teacherKey: teacherKey || "",
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = (data as any)?.error || `Join API failed (${res.status})`;
    throw new Error(msg);
  }

  return data as JoinResponse;
}
