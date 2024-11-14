import * as Ably from "ably";

export const socketChannels = {
  voting: {
    name: "voting",
    events: {
      update: "update",
    },
  },
};

export const socket = new Ably.Realtime({
  key: process.env.NEXT_PUBLIC_ALBY_API_KEY,
});
