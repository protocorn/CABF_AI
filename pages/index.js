import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-3xl font-bold mb-6">Document Management System</h1>
      <div className="space-x-4">
        <Link href="/add-document">
          <button className="px-4 py-2 bg-blue-500 text-white rounded-lg">Add Document</button>
        </Link>
        <Link href="/generate-document">
          <button className="px-4 py-2 bg-green-500 text-white rounded-lg">Generate Document</button>
        </Link>
      </div>
    </div>
  );
} 