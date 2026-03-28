import csv
import io

from models.schemas import RankedLead


def build_ranked_leads_csv(leads: list[RankedLead]) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "rank",
            "company_name",
            "score",
            "website",
            "industry",
            "company_size",
            "location",
            "contact_person",
            "contact_title",
            "email",
            "linkedin_url",
            "match_reasons",
        ]
    )

    for lead in leads:
        writer.writerow(
            [
                lead.rank,
                lead.company_name,
                f"{lead.score:.4f}",
                lead.website or "",
                lead.industry or "",
                lead.company_size or "",
                lead.location or "",
                lead.contact_person or "",
                lead.contact_title or "",
                lead.email or "",
                lead.linkedin_url or "",
                " | ".join(lead.match_reasons),
            ]
        )

    return buffer.getvalue()
