"use client";

import { PropsWithChildren } from "react";
import { AblyProvider, ChannelProvider } from "ably/react";
import { ablySocketClient } from "@/lib/subscription/client";
import { socketChannels } from "@/lib/subscription/channels";

export const Providers = ({ children }: PropsWithChildren) => {
  return (
    <AblyProvider client={ablySocketClient}>
      <ChannelProvider channelName={socketChannels.voting.name}>
        {children}
      </ChannelProvider>
    </AblyProvider>
  );
};
