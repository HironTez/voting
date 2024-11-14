"use client";

import { PropsWithChildren } from "react";
import { AblyProvider, ChannelProvider } from "ably/react";
import { socket, socketChannels } from "@/lib/subscription";

export const Providers = ({ children }: PropsWithChildren) => {
  return (
    <AblyProvider client={socket}>
      <ChannelProvider channelName={socketChannels.voting.name}>
        {children}
      </ChannelProvider>
    </AblyProvider>
  );
};
