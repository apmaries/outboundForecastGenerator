import base64
import requests as r
import sys
import json
import csv
import time
import os
import urllib.parse
from datetime import datetime as dt
from datetime import timedelta as td
from datetime import date as d


run_time = time.strftime("%y%m%d_%H%M%S", time.localtime())
directory = os.path.dirname(os.path.abspath(__file__))

# set variables
source_region = "mypurecloud.com.au"
source_client_id = os.getenv('red_p_client_id')
source_client_secret = os.getenv('red_p_client_secret')
print(source_client_id)

source_auth_url = "https://login." + source_region
source_api_url = "https://api." + source_region
source_apps_url = "https://apps." + source_region

end_utc = "2024-01-21T13:00:00.000Z"
end_date = dt.strptime(end_utc, "%Y-%m-%dT%H:%M:%S.%fZ")
n_weeks = 6
start_date = end_date - td(weeks=n_weeks)
start_utc = dt.strftime(start_date, "%Y-%m-%dT%H:%M:%S.%fZ")

interval = f"{start_utc}/{end_utc}"

ndays = (end_date - start_date).days
max_days = 7
runs = (ndays // max_days) + 1


queryBody = {
    "filter": {
        "type": "and",
        "clauses": [
            {
                "type": "or",
                "predicates": [
                    {
                        "dimension": "outboundCampaignId",
                        "value": "ce713659-c13a-486e-b978-28b77436bf67",
                    },
                    {
                        "dimension": "outboundCampaignId",
                        "value": "c1a07179-b2f2-4251-a1fa-9fd9b3219174",
                    },
                ],
            }
        ],
        "predicates": [{"dimension": "mediaType", "value": "voice"}],
    },
    "metrics": [
        "nOutboundAttempted",
        "nOutboundConnected",
        "tHandle",
    ],
    "groupBy": ["outboundCampaignId", "queueId"],
    "granularity": "PT15M",
    "interval": "",
}


def split_list(l, n):
    n = n

    for i in range(0, len(l), n):
        yield l[i : i + n]


def connect(client_id, client_secret, auth_url):
    # base64 encode the client ID and client secret
    authorization = base64.b64encode(
        bytes(client_id + ":" + client_secret, "ISO-8859-1")
    ).decode("ascii")

    # prepare for POST /oauth/token request
    request_headers = {
        "Authorization": f"Basic {authorization}",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    request_body = {"grant_type": "client_credentials"}

    # get token - need to allow for different regions
    response = r.post(
        auth_url + "/oauth/token", data=request_body, headers=request_headers
    )

    # check response
    if response.status_code == 200:
        print(f"Authenticated in {auth_url}")
        print()
    else:
        print(f"Failure: { str(response.status_code) } - { response.reason }")
        sys.exit(response.status_code)

    # get JSON response body
    response_json = response.json()

    # prepare for API requests
    requestHeaders = {
        "Authorization": f"{ response_json['token_type'] } { response_json['access_token']}"
    }

    postHeaders = {
        "Content-Type": "application/json",
        "Authorization": f"{ response_json['token_type'] } { response_json['access_token']}",
    }
    return (requestHeaders, postHeaders)


def runQuery(_headers):
    print("Querying conversations aggregates data")
    post_headers = _headers[1]

    query_results = []

    for run in range(runs):
        r_num = run + 1
        run_start = start_date + td(days=run * 7)
        run_end = (run_start + td(days=7)) - td(minutes=15)
        run_interval = (
            dt.strftime(run_start, "%Y-%m-%dT%H:%M:%S.000Z")
            + "/"
            + dt.strftime(run_end, "%Y-%m-%dT%H:%M:%S.000Z")
        )
        print(f"Run {r_num} - {run_interval} starting")

        queryBody["interval"] = run_interval

        query_response = r.post(
            f"{source_api_url}/api/v2/analytics/conversations/aggregates/query",
            json=queryBody,
            headers=post_headers,
        )
        try:
            query_data = json.loads(query_response.content)["results"]
            print(f"Run {r_num} - {run_interval} completed with data")
        except:
            print(f"Run {r_num} - {run_interval} completed with no data")
            continue

        query_results.extend(query_data)
    return query_results

# function to export data to json in current directory
def exportData(data):
    with open(f"{directory}/testData.json", "w") as f:
        json.dump(data, f, indent=4)
    print(f"Data exported to {directory}/testData.json")

def main():
    # connect to source
    print("Connecting to source")
    _headers = connect(source_client_id, source_client_secret, source_auth_url)

    print(f"Start date of query = {start_date}")
    print(f"End date of query = {end_date}")
    print(f"Total days = {ndays}")
    print(f"{runs} queries to be run of max {max_days} days duration\n")

    # run query
    _results = runQuery(_headers)
    
    # export data
    exportData(_results)

if __name__ == "__main__":
    print(f"Export campaign historical data\n")
    main()