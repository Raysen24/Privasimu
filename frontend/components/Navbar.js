import React from "react";
import { useRouter } from "next/router";

export default function Navbar({ title, searchTerm, setSearchTerm }) {
  const router = useRouter();
  const hideSearch = router.pathname === "/add-regulation"; // 👈 hide only on Add Regulation page

  return (
    <nav className="w-full bg-white border-b border-gray-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm sticky top-0 z-50">
      <h1 className="text-xl font-semibold text-gray-800">{title}</h1>

      {!hideSearch && (
        <div className="w-full sm:w-1/2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search..."
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      )}
    </nav>
  );
}
