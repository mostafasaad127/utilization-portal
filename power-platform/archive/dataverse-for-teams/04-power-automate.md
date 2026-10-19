# 4. Power Automate flows

Create these flows in the Team's environment (**Power Apps in Teams → Build → [your Team] → Cloud flows**, or the **Power Automate** app in Teams with the Team's environment selected). Use the **Microsoft Dataverse** connector, which is included for Dataverse for Teams.

> Build the flows as a Team **owner**. They run with your connection, so they can see every row. Add a second admin as **co-owner** of each flow so they keep running if you're away.

**Finding internal names:** filter expressions need the *logical* column names (for example `cr8a1_status`) and choice *numbers* (for example Active = `100000001`). Find them under **Build → See all → Tables → [table] → column → Advanced**. Where this guide writes `prefix_`, use your prefix.

---

## Flow 1: Status update → project RAG

When anyone posts a status update, the project's RAG and **Last update on** change automatically. Employees don't need edit rights on projects for this.

1. **Trigger:** Dataverse – *When a row is added, modified or deleted*
   - Change type **Added**, Table **Status updates**, Scope **Organization**
2. **Compose** `RAG label`:
   `triggerOutputs()?['body/prefix_rag@OData.Community.Display.V1.FormattedValue']`
3. **Switch** on `RAG label`, with cases **Green**, **Amber** and **Red**. Each case runs Dataverse – *Update a row*:
   - Table **Projects**, Row ID `triggerOutputs()?['body/_prefix_project_value']`
   - **RAG:** pick the matching value from the dropdown. Status-update RAG and project RAG are separate choices, which is why the label is matched rather than the number.
   - **Last update on:** `utcNow('yyyy-MM-dd')`

## Flow 2: Monday "please update your project" nudge

1. **Trigger:** *Recurrence*, weekly, **Monday 09:00**, time zone **(UTC+00:00) Dublin, Edinburgh, Lisbon, London**
2. Dataverse – *List rows*, Table **Projects**, Filter rows:
   ```
   (prefix_status eq <Active> or prefix_status eq <On hold>) and
   (prefix_lastupdateon eq null or prefix_lastupdateon lt @{formatDateTime(addDays(utcNow(), -14), 'yyyy-MM-dd')})
   ```
3. **Apply to each** project, then inside it:
   1. Dataverse – *List rows*, Table **Assignments**
      - Filter rows: `_prefix_project_value eq @{items('Apply_to_each')?['prefix_projectid']}`
      - Expand query: `prefix_Person($select=prefix_name,prefix_email)`
   2. *Filter array*, keeping current assignments: start date ≤ today, and end date empty or ≥ today
   3. **Apply to each** assignment → Teams – *Post card in a chat or channel*:
      - Post as **Flow bot**, Post in **Chat with Flow bot**, Recipient `items('Apply_to_each_2')?['prefix_Person/prefix_email']`
      - Adaptive card:
        ```json
        {
          "type": "AdaptiveCard", "version": "1.4",
          "body": [
            { "type": "TextBlock", "size": "Medium", "weight": "Bolder", "text": "Time for a project update" },
            { "type": "TextBlock", "wrap": true,
              "text": "**@{items('Apply_to_each')?['prefix_name']}** hasn't had a status update in two weeks. Please post a short update and confirm the RAG." }
          ],
          "actions": [ { "type": "Action.OpenUrl", "title": "Open Utilization", "url": "<link to the app tab>" } ]
        }
        ```
        Get the link from the app's tab in Teams (**⋯ → Copy link to tab**).

## Flow 3: Roll-off alert for admins

1. **Trigger:** *Recurrence*, weekly, **Monday 08:30**
2. Dataverse – *List rows*, Table **Assignments**
   - Filter rows:
     ```
     prefix_enddate ge @{utcNow('yyyy-MM-dd')} and prefix_enddate le @{formatDateTime(addDays(utcNow(), 14), 'yyyy-MM-dd')}
     ```
   - Expand query: `prefix_Person($select=prefix_name),prefix_Project($select=prefix_name)`
3. Repeat step 2 for **Projects** ending in the same window, to catch assignments with no end date of their own that inherit the project's end date.
4. *Select*: map Person, Project and End date. Then *Create HTML table*.
5. Teams – *Post message in a chat or channel*, to a **private admins channel**: "Rolling off in the next 14 days", followed by the HTML table. Wrap it in a *Condition* so nothing is posted when the list is empty.

## Flow 4 (optional): closing a project fills its end date

This keeps utilization accurate, because a closed project with no end date is ignored.

1. **Trigger:** Dataverse – *When a row is added, modified or deleted*
   - Change type **Modified**, Table **Projects**, Select columns `prefix_status`
2. **Condition:** Status = *Closed* **and** End date is empty
3. **If yes:** *Update a row* on the same project, setting **End date** to `utcNow('yyyy-MM-dd')`

## Testing

- **Flow 1:** post a Red update from the app. The project's RAG turns Red within a minute.
- **Flows 2 and 3:** use **Test → Manually** before switching on the schedule, with yourself as the only recipient for the first run.
