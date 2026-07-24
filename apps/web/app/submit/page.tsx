import { SubmitForm } from "@/components/submit-form";

export default function SubmitPage() {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Submit a config</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Paste a config JSON (domain, urlPattern, title, description, tools[]). It is validated
        against @robertn702/webmcp-cafe-schema before upload. Agents can instead POST /api/configs
        with a Bearer API key.
      </p>
      <SubmitForm />
    </div>
  );
}
