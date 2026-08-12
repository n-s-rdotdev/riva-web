"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CornerDownLeftIcon, SearchIcon } from "lucide-react"

import { navigations } from "@/lib/site-config"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"

export function SiteCommand() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const runCommand = useCallback((command: () => void) => {
    setOpen(false)
    command()
  }, [])

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (
        (event.key === "k" && (event.metaKey || event.ctrlKey)) ||
        event.key === "/"
      ) {
        if (
          (event.target instanceof HTMLElement &&
            event.target.isContentEditable) ||
          event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement ||
          event.target instanceof HTMLSelectElement
        ) {
          return
        }

        event.preventDefault()
        setOpen((current) => !current)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline" className="w-fit">
        <SearchIcon />
        <span className="sr-only">Search pages</span>
        <CommandShortcut className="hidden md:block md:ml-2">
          ⌘K
        </CommandShortcut>
      </Button>

      <CommandDialog
        description="Search for a page to open."
        onOpenChange={setOpen}
        open={open}
        title="Search pages"
        className="pb-11"
      >
        <Command className="bg-transparent">
          <CommandInput placeholder="Search pages..." />
          <CommandList className="min-h-80 scroll-pt-2 scroll-pb-1.5">
            <CommandEmpty className="py-12 text-center text-sm text-muted-foreground">
              No results found.
            </CommandEmpty>
            <CommandGroup heading="Pages">
              {navigations.map((item) => (
                <CommandItem
                  className="h-9 rounded-md border border-transparent px-3! font-medium hover:border-input hover:bg-input/50"
                  key={item.href}
                  keywords={item.keywords}
                  onSelect={() => {
                    runCommand(() => router.push(item.href))
                  }}
                  value={item.title}
                >
                  <item.icon aria-hidden="true" className="size-4" />
                  {item.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>

        <div className="absolute inset-x-0 bottom-0 z-20 flex h-10 items-center gap-2 rounded-b-xl border-t bg-secondary px-4 text-xs font-medium text-muted-foreground">
          <Kbd>
            <CornerDownLeftIcon aria-hidden="true" className="size-3" />
          </Kbd>
          Select
        </div>
      </CommandDialog>
    </>
  )
}
