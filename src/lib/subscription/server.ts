import * as Ably from "ably";

export const ablyRestClient = new Ably.Rest({
  key: process.env.NEXT_PUBLIC_ALBY_API_KEY,
});
