---
name: convert-prospect
description: Use when a prospect has engaged and should become a lead (for example "convert Pia to a lead" or "this prospect replied, move them on"). Creates the lead, links the company, and marks the prospect converted, safely repeatable.
---

# Convert a prospect to a lead

A prospect is a person you intend to reach. A lead is a person who has shown interest. Converting keeps the prospect (marked `converted`) and creates a lead beside it. There is no convert tool: use the CRM tools in this order. The order makes it safe to run again after a failure, so do not reorder it.

## Steps

1. **Read both shapes.** `describe_object_type` for `prospect` and `lead`. Copy only fields that exist on both with the same name and type. If the lead has a required field the prospect lacks, ask the person once for it.
2. **Get the prospect** with `get_record`. If its status is `disqualified`, confirm with the person before going on.
3. **Resume check.** `list_linked_records` on the prospect, link `prospect_lead`. If a lead is already there, a previous run got this far: reuse that lead and skip to step 6.
4. **Look for an existing lead** with `filter_records` on `lead` by the prospect's email. If one exists, use it and tell the person you reused it. Do not create a second.
5. **Create the lead** with `create_record`: first_name, last_name, email, phone, job_title and source from the prospect, `status: "new"`. Never put links in `properties`; links are separate calls. If this fails with `DUPLICATE_VALUE` and an `existing_id`, use that lead. If there is no `existing_id`, a lead with that email exists that the person cannot see: stop and say so. Do not try to find it.
6. **Link the company.** `list_linked_records` on the prospect, link `prospect_company`, then `link_record` each company to the lead through `lead_company`.
7. **Link the lead back:** `link_record` on the prospect, link `prospect_lead`, `record_id` the lead. A prospect holds one lead, so this replaces any other.
8. **Mark converted, last:** `update_record` the prospect, `status: "converted"`.

## Rules

- If any step fails, stop, say which step and why, and leave the prospect unmarked. Running the skill again resumes from step 3.
- Never delete the prospect. Do not change the lead's status after creating it; `new` is correct.
- Finish with one short summary: the lead (name and id), the companies linked, and anything reused rather than created.
