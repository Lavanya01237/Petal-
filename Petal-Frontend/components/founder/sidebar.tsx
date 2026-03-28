"use client";

import {
  Database,
  FlowerLotus,
  GearSix,
  House,
  SquaresFour,
  UserCircle,
} from "phosphor-react";

export function FounderSidebar() {
  return (
    <aside className="hidden h-full w-[62px] shrink-0 border-r border-[#c8dddc] bg-[#e7f4f3] md:flex md:flex-col md:items-center md:justify-between md:py-5">
      <div className="flex flex-col items-center gap-5">
        <div className="flex size-10 items-center justify-center text-[#1ba39c]">
          <FlowerLotus className="size-5" weight="duotone" />
        </div>
        <div className="flex flex-col gap-2">
          <button
            className="flex size-10 items-center justify-center text-[#1ba39c] transition-colors hover:text-[#127a73]"
            type="button"
          >
            <House className="size-5" weight="duotone" />
          </button>
          <button
            className="flex size-10 items-center justify-center text-[#a3afb9] transition-colors hover:text-[#43505f]"
            type="button"
          >
            <SquaresFour className="size-5" weight="duotone" />
          </button>
          <button
            className="flex size-10 items-center justify-center text-[#a3afb9] transition-colors hover:text-[#43505f]"
            type="button"
          >
            <Database className="size-5" weight="duotone" />
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <button
          className="flex size-10 items-center justify-center text-[#a3afb9] transition-colors hover:text-[#43505f]"
          type="button"
        >
          <GearSix className="size-5" weight="duotone" />
        </button>
        <button
          className="flex size-10 items-center justify-center text-[#177d77]"
          type="button"
        >
          <UserCircle className="size-5" weight="duotone" />
        </button>
      </div>
    </aside>
  );
}
