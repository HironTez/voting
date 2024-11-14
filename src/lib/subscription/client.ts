import * as Ably from "ably";

export const ablySocketClient = new Ably.Realtime({
  key: process.env.NEXT_PUBLIC_ALBY_API_KEY,
});
