import { ExcelUploader } from "@/components/upload/ExcelUploader";
import { MusicianUploader } from "@/components/upload/MusicianUploader";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-8">
      <header className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold">LMS Turnéplanner</h1>
        <p className="text-gray-600">
          Upload turnéplan og musikerliste for at komme i gang.
        </p>
      </header>
      <ExcelUploader />
      <MusicianUploader />
      <p className="text-center text-xs text-gray-400">
        <a href="/admin" className="hover:underline">
          Administrer hoteldata
        </a>
      </p>
    </main>
  );
}
