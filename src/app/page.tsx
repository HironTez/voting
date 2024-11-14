"use client";

import { useChannel } from "ably/react";
import { socketChannels } from "@/lib/subscription/channels";
import { useEffect, useState } from "react";
import {
  addEntry,
  deleteEntry,
  fetchEntries,
  fetchEntry,
  retractVoteForEntry,
  updateEntry,
  upsertUsername,
  voteForEntry,
} from "./serverActions";
import { useCookies } from "react-cookie";
import { Prisma } from "@prisma/client";
import { addAt, removeAt, replaceAt } from "@/lib/utils";
import { Message } from "ably";
import { useDebouncedCallback } from "use-debounce";
// import moment from "moment";
import {
  Button,
  Card,
  IconButton,
  LinearProgress,
  TextField,
  Icon,
} from "actify";
import { useAutosize } from "@/lib/utils/hooks";
import { Toaster, toast } from "sonner";
// import { Icon } from "@/app/components/icon";

const getEmptyEntry = (username: string) => ({
  id: "",
  text: "",
  voters: [],
  voterIds: [],
  createdById: "",
  createdBy: { id: "", username, voteEntryIds: [] },
  createdAt: new Date(),
  updatedById: "",
  updatedBy: { id: "", username, voteEntryIds: [] },
  updatedAt: new Date(),
});

type Entry = Prisma.EntryGetPayload<{
  include: { createdBy: true; updatedBy: true; voters: true };
}>;

export default function Home() {
  useAutosize();

  const [loading, setLoading] = useState<null | string>(null);
  const autoLoading = async (callback: () => Promise<void>) => {
    const id = Math.random().toString();
    setLoading(id);
    return callback().finally(() => {
      setLoading((loading) => (loading === id ? null : loading));
    });
  };

  const usernameTag = "username";
  const [cookies, setCookie] = useCookies([usernameTag]);

  const [username, setUsername] = useState(
    (cookies.username as string | undefined) ?? ""
  );
  const [entries, setEntries] = useState<Entry[]>([]);

  const setEntry = (entry: Entry | null, id: string) => {
    const index = entries.findIndex((e) => e.id === id || e.id === "");
    if (index >= 0) {
      if (entry) {
        setEntries(replaceAt(entries, index, entry));
      } else {
        setEntries(removeAt(entries, index));
      }
    } else if (entry) {
      setEntries([...entries, entry]);
    }
  };

  const getEntries = async () => {
    setEntries(await fetchEntries());
  };
  const getEntry = async (id: string) => {
    setEntry(await fetchEntry(id), id);
  };

  useEffect(() => {
    autoLoading(getEntries);

    const abortController = new AbortController();

    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.visibilityState === "visible") {
          autoLoading(getEntries);
        }
      },
      { signal: abortController.signal }
    );

    return () => {
      abortController.abort();
    };
  }, []);

  const onUpdateMessage = async (message: Message) => {
    autoLoading(async () => {
      const id = message.data;
      if (typeof id !== "string") return;
      await getEntry(id);
    });
  };

  useChannel(
    socketChannels.voting.name,
    socketChannels.voting.events.update,
    onUpdateMessage
  );

  const handleUsernameChange = async (
    username: string,
    prevUsername: string
  ) => {
    autoLoading(async () => {
      await upsertUsername(username, prevUsername);

      await getEntries();
      setCookie(usernameTag, username);
    });
  };

  const onUsernameValueChange = async (value: string) => {
    const prevUsername = username;
    setUsername(value);
    setEntries((entries) =>
      entries.map((entry) =>
        entry.createdBy.username === prevUsername
          ? { ...entry, createdBy: { ...entry.createdBy, username: value } }
          : entry.updatedBy?.username === prevUsername
          ? { ...entry, updatedBy: { ...entry.updatedBy, username: value } }
          : entry
      )
    );
  };
  const onUsernameFocusChange = async (isFocused: boolean) => {
    if (!isFocused) {
      const prevUsername = cookies.username as string | undefined;
      await handleUsernameChange(username, prevUsername ?? "");
    }
  };

  const handleUpdateEntry = useDebouncedCallback(
    async (id: string, value: string) => {
      autoLoading(async () => {
        await updateEntry(id, value, username);
      });
    },
    3000
  );
  const handleDeleteEntry = async (entry: Entry) => {
    const index = entries.indexOf(entry);

    setEntry(null, entry.id);
    toast(
      `Удалено${entry.text && ": "}${
        entry.text.length > 25 ? `${entry.text.slice(0, 25)}...` : entry.text
      }`,
      {
        action: {
          label: "Отменить",
          onClick: async () => {
            setEntries((entries) => addAt(entries, index, entry));
          },
        },
        onAutoClose: async () => {
          autoLoading(async () => {
            await deleteEntry(entry.id);
          });
        },
      }
    );
  };
  const handleAddEntry = async () => {
    autoLoading(async () => {
      setEntry(getEmptyEntry(username), "");
      await addEntry("", username);
    });
  };
  const handleToggleVote = async (
    id: string,
    entry: Entry,
    hasVotedForEntry: boolean
  ) => {
    autoLoading(async () => {
      if (hasVotedForEntry) {
        setEntry(
          {
            ...entry,
            voters: entry.voters.filter((voter) => voter.username !== username),
          },
          id
        );
        await retractVoteForEntry(id, username);
      } else {
        setEntry(
          {
            ...entry,
            voters: entry.voters.concat({
              id: "",
              username,
              voteEntryIds: [entry.id],
            }),
          },
          id
        );
        await voteForEntry(id, username);
      }
    });
  };

  return (
    <div className="flex items-center justify-center">
      <main className="max-w-[500px] w-full flex flex-col gap-5 p-5">
        <LinearProgress
          indeterminate
          className={loading ? "visible" : "invisible"}
        />

        <TextField
          label="Имя"
          type="text"
          value={username}
          onChange={onUsernameValueChange}
          variant="outlined"
          isDisabled={!!loading}
          onFocusChange={onUsernameFocusChange}
        />

        <div
          className={`flex flex-col gap-3 ${
            username ? "visible" : "invisible"
          }`}
        >
          {entries.map((entry, index) => {
            const hasVotedForEntry = entry.voters.some(
              (voter) => voter.username === username
            );
            return (
              <Card variant="filled" className="grow" key={entry.id}>
                <div className="p-3 flex flex-col gap-2">
                  <div className="grow rounded-t-lg overflow-hidden">
                    <TextField
                      label="Предложение"
                      type="textarea"
                      value={entry.text}
                      onChange={(value: string) => {
                        setEntries((entries) =>
                          replaceAt(entries, index, {
                            ...entry,
                            text: value,
                          })
                        );
                        handleUpdateEntry(entry.id, value);
                      }}
                      variant="filled"
                      isDisabled={!!loading}
                    />
                  </div>
                  <div className="flex justify-between">
                    <div>
                      <p>Автор: {entry.createdBy.username}</p>
                      {entry.updatedBy &&
                        entry.updatedBy.id !== entry.createdBy.id && (
                          <p>
                            Изменил(а): {entry.updatedBy?.username}
                            {/* {" "}(
                            {moment(entry.updatedAt).format("HH:mm DD.MM.YY")}) */}
                          </p>
                        )}
                      <p>За: {entry.voters.length}</p>
                    </div>
                    <div className="flex gap-1">
                      <IconButton
                        onPress={() =>
                          handleToggleVote(entry.id, entry, hasVotedForEntry)
                        }
                        isDisabled={!!loading}
                      >
                        <Icon style={{ fill: "1" }} fill={hasVotedForEntry}>
                          favorite
                        </Icon>
                      </IconButton>
                      <IconButton
                        onPress={() => handleDeleteEntry(entry)}
                        isDisabled={!!loading}
                      >
                        <Icon>delete</Icon>
                      </IconButton>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}

          <Button
            onPress={handleAddEntry}
            variant="outlined"
            className="w-full"
            isDisabled={!!loading}
          >
            <Icon>add</Icon>
          </Button>
        </div>
      </main>
      <Toaster />
    </div>
  );
}
