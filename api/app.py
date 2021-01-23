from flask import Flask, request, jsonify, render_template, Blueprint, abort
from functools import reduce
from flask_cors import CORS
import pdb
import glob
import pandas as pd
from threading import Timer
from time import sleep
from datetime import datetime
from absl import logging
from datetime import date, timedelta, datetime
import coord
import requests
from functools import reduce
import sys
import os
import pandas
import glob
import re
import string

app = Flask(__name__)
CORS(app)

file_list = {}
twitter_data_file_list = []
twitter_data = None

source_list_input_prefix = '../../covid19data/data_collection/data/input/'
source_list_output_prefix = '../../covid19data/data_collection/data/out/'
source_list = {
    'COVID Tracking Project': 'ctp_s.csv',  # state
    'NY Times': {
        'state': 'nyt_s.csv',  # state
        'county': 'nyt_c.csv',  # county
    },
    'JHU': {
        'country': 'jhu_g.csv',  # country and province
        'state': 'jhu_s.csv',  # state
        'county': 'jhu_c.csv',  # county
    }
}
source_list_per_level = {
    'global': ['JHU'],
    'country': ['JHU'],
    'state': ['COVID Tracking Project', 'NY Times', 'JHU'],
    'county': ['JHU', 'NY Times']
}
misinformation_panel_source = "../../twitter_data/processed"

refresh_interval_hrs = 1
refreshing = False
query_processes = []


def clear_cached_data():
    file_list.clear()
    twitter_data_file_list = []
    twitter_data = None


def daterange(start_date, end_date):
    for n in range(int ((end_date - start_date).days) + 1):
        yield start_date + timedelta(n)


def str_to_date(inp):
    return datetime.strptime(inp, "%Y-%m-%d").date()


@app.route('/api/v1/sourcequery')
def source_query():
    if 'level' in request.args:
        lev = request.args['level']
        if lev in ['global', 'country', 'state', 'county']:
            return jsonify(source_list_per_level[lev])
        else:
            return '{} is not in the allowed list of levels: {}'.format(lev, ['global', 'country', 'state', 'county'])
    else:
        return jsonify([key for key, _ in source_list.items()])


def preprocess_node(node):
    entity_type = select_entity_type(node)
    logging.info('is {}'.format(entity_type))

    if entity_type == 'county':
        node = node.replace(' county', '')
        node = node.replace(' borough', '')
        node = node.replace(' parish', '')
        node = node.replace(' - ', '-')
        node = node.replace("'", '')

    return node, entity_type

port = 2222 if not len(sys.argv) > 1 else int(sys.argv[1])

@app.route('/api/v1/ping')
def ping():
    global refreshing, query_processes

    while refreshing:
        logging.info('query received, waiting for refresh to complete')
        sleep(0.5)

    pid = 0 if len(query_processes) == 0 else query_processes[-1] + 1
    query_processes.append(pid)

    logging.info('Processing request...')

    def check_shape(df):
        out = False
        try:
            out = df[0].shape[0] > 0
        except:
            pass
        return out
    read_status = []
    for key, value in source_list.items():
        if key != 'JHU' and key != 'NY Times':
            read_status.append((key, 200 if check_shape(prc(value)) else 500))
        else:
            for subkey, subvalue in source_list[key].items():
                read_status.append((f"{key} - {subkey}", 200 if check_shape(prc(subvalue)) else 500))
    data_sources = {"Data Sources":{"size":len(read_status),
                                    **{t[0]:t[1] for t in read_status}}}

    qkwargs = {"statquery":{"node":"Tarrant County-Texas",
                            "date":"2020-04-30",
                            **{f"dsrc_{area}":"JHU" for area in ["global",
                                                                 "country",
                                                                 "state",
                                                                 "county"]}},
               "statquery_timeseries":{"node":"Tarrant%20County-Texas",
                                       "dsrc":"JHU",
                                       "date_start":"2020-01-23",
                                       "date_end":"2020-04-30"},
               "mapquery_county":{"date":"2020-04-30",
                                  "node_state":"texas",
                                  "dsrc_county":"JHU"}}
    prefix = f"http://localhost:{port}/api/v1"
    def to_querystr(d):
        return reduce(lambda acc, it: f"{acc}&{it[0]}={it[1]}", d.items(), "")[1:]
    query_responses = {"Query Responses":{"size":len(qkwargs),
                                          **{k: requests.get(f"{prefix}/{k}?{to_querystr(v)}").status_code \
                                                  for k, v in qkwargs.items()}}}


    groups = {**data_sources, **query_responses}
    ret = {"use_groups":True,
           "size":len(groups),
           "interval":15,
           **groups}
    ret = jsonify(ret)

    query_processes.remove(pid)
    logging.info(query_processes)

    return ret

@app.route('/api/v1/mapquery_country_state')
def mapquery_country_state():
    global refreshing, query_processes

    while refreshing:
        logging.info('query received, waiting for refresh to complete')
        sleep(0.5)

    pid = 0 if len(query_processes) == 0 else query_processes[-1] + 1
    query_processes.append(pid)

    if (all([x in request.args for x in ['date', 'dsrc_country', 'dsrc_state']])):
        date = request.args['date']
        sources = {
            'country': request.args['dsrc_country'],
            'state': request.args['dsrc_state'],
        }
    else:
        query_processes.remove(pid)
        logging.info(query_processes)
        abort(400)

    logging.info('Processing request...')

    fail = False
    ret = {
        "states": [],
        "countries": []
    }
    try:
        for node in [('global', 'countries'), ('us', 'states')]:
            node, dict_loc = node

            node, entity_type = preprocess_node(node)
            child_entity_type = get_children_type(entity_type)

            ret[dict_loc] = [{
                'name': process_names(x, child_entity_type),
                'default_stats': get_data_from_source(x, date, sources[child_entity_type], child_entity_type),
                'lat': coord.get_coords(x, child_entity_type)[0],
                'long': coord.get_coords(x, child_entity_type)[1]
            } for x in get_children(node, entity_type)]

        ret = jsonify(ret)
    except Exception as e:
        logging.info('Error: {}'.format(e))
        logging.info('Terminating process with code 500')
        fail = True

    query_processes.remove(pid)
    logging.info(query_processes)

    if fail:
        abort(500)
    else:
        return ret


@app.route('/api/v1/mapquery_county')
def mapquery_county():
    global refreshing, query_processes

    while refreshing:
        logging.info('query received, waiting for refresh to complete')
        sleep(0.5)

    pid = 0 if len(query_processes) == 0 else query_processes[-1] + 1
    query_processes.append(pid)

    if (all([x in request.args for x in ['node_state', 'date', 'dsrc_county']])):
        node_state = request.args['node_state'].lower()
        date = request.args['date']
        dsrc_county = request.args['dsrc_county']
    else:
        query_processes.remove(pid)
        logging.info(query_processes)
        abort(400)

    logging.info('Processing request...')

    fail = False
    ret = {}
    try:
        node_state, entity_type = preprocess_node(node_state)
        child_entity_type = get_children_type(entity_type)

        ret = [{
            'name': process_names(x, child_entity_type),
            'default_stats': get_data_from_source(x, date, dsrc_county, child_entity_type)
        } for x in get_children(node_state, entity_type)]

        ret = jsonify(ret)
    except Exception as e:
        logging.info('Error: {}'.format(e))
        logging.info('Terminating process with code 500')
        fail = True

    query_processes.remove(pid)
    logging.info(query_processes)

    if fail:
        abort(500)
    else:
        return ret


@app.route('/api/v1/querylatestdate')
def query_latest_date():
    ar = sorted([k for k, _ in file_list['JHU']['country'][1].items()])
    return jsonify('n/a' if len(ar) == 0 else ar[-1])


@app.route('/api/v1/statquery_timeseries')
def stat_query_time_series():
    global refreshing, query_processes

    while refreshing:
        logging.info('query received, waiting for refresh to complete')
        sleep(0.5)

    pid = 0 if len(query_processes) == 0 else query_processes[-1] + 1
    query_processes.append(pid)

    if (all([x in request.args for x in ['node', 'date_start', 'date_end', 'dsrc']])):
        node = request.args['node'].lower()
        date_start = request.args['date_start']
        date_end = request.args['date_end']
        dsrc = request.args['dsrc']
    else:
        query_processes.remove(pid)
        logging.info(query_processes)
        abort(400)

    logging.info('Processing request...')

    fail = False
    ret = {}
    try:
        node, entity_type = preprocess_node(node)

        ret = [{
            'date': single_date.strftime("%Y-%m-%d"),
            'stats': get_data_from_source(node, single_date.strftime("%Y-%m-%d"), dsrc, entity_type)
        } for single_date in daterange(str_to_date(date_start), str_to_date(date_end))]

        ret = jsonify(ret)
    except Exception as e:
        logging.info('Error: {}'.format(e))
        logging.info('Terminating process with code 500')
        fail = True

    query_processes.remove(pid)
    logging.info(query_processes)

    if fail:
        abort(500)
    else:
        return ret


@app.route('/api/v1/statquery_details')
def stat_query_details():
    global refreshing, query_processes

    while refreshing:
        logging.info('query received, waiting for refresh to complete')
        sleep(0.5)

    pid = 0 if len(query_processes) == 0 else query_processes[-1] + 1
    query_processes.append(pid)

    if (all([x in request.args for x in ['node', 'date']])):
        node = request.args['node'].lower()
        date = request.args['date']
    else:
        query_processes.remove(pid)
        logging.info(query_processes)
        abort(400)

    logging.info('Processing request...')

    fail = False
    ret = {}
    try:
        node, entity_type = preprocess_node(node)
        ret = jsonify(get_all_data(node, date, entity_type))
    except Exception as e:
        logging.info('Error: {}'.format(e))
        logging.info('Terminating process with code 500')
        fail = True

    query_processes.remove(pid)
    logging.info(query_processes)

    if fail:
        abort(500)
    else:
        return ret

def mquery_aux(node, date, entity_type):
    files = [s.replace("\\","/") for s in glob.glob(f"{misinformation_panel_source}/*dtctn_cnt.csv")]
    df = reduce(lambda acc, it: pd.concat([acc, it], sort=False),
                map(pd.read_csv, files)).reset_index(drop=True)
    querycol = f"User{entity_type[0].upper()}{entity_type[1:]}"

    def scanner(s, substr=node): return substr.lower() in s.lower()

    mask1 = df[querycol].map(scanner, na_action='ignore')
    relevant_rows = df[mask1.map(lambda b: b if type(b) == bool else False)]

    def derive_object(df):
        labels    = ["agree", "discuss", "disagree"]
        label2int = dict(zip(labels,
                             map(float, range(len(labels)))))
        int2label = dict((v, k) for k, v in label2int.items())
        figures   = dict(zip(labels,
                             [0]*len(labels)))

        for i in df["stance"].unique():
            figures[int2label[i]] = int(df[df["stance"] == i]["stance.1"].values[0])

        text_data = {"summary":df.iloc[0]["Fact"],
                     "source":df.iloc[0]["SourceUrl"],
                     "taxonomy":df.iloc[0]["Taxonomy"]}
        out       = {**figures, **text_data}

        return pd.Series(out)

    gg = relevant_rows.groupby(["Fact","Taxonomy", "SourceUrl"], as_index=False)

    out = gg.apply(derive_object)

    translate_dict = {
        "Fact": "summary",
        "SourceUrl":"source",
        "Taxonomy":"taxonomy"
    }
    targets = ["summary", "source", "taxonomy"]
    sources = ["Fact", "SourceUrl", "Taxonomy"]
    translate_dict = dict(zip(sources, targets))
    intermed_dict = dict(zip(targets, targets))
    translate_dict = {**translate_dict, **intermed_dict}

    passthru = ["agree", "disagree", "discuss"]

    out_list = []
    items = out.values.tolist()
    for i in items:
        it = dict(zip(out.columns, i))
        d = {translate_dict[k]: v for k, v in it.items() if k in translate_dict}
        for c in passthru:
            d[c] = it[c]
        out_list.append(d)

    return out_list

@app.route('/api/v1/mtweets') # endpoint for user to query for tweet view
def mtweets():
    if not all([x in request.args for x in ['sourceUrl', 'summary']]): #require these arguments
        abort(400)

    logging.info('Processing request...')
    desired_cols = ['TweetText', 'stance']
    return_data = twitter_data.loc[
        twitter_data.SourceUrl == request.args['sourceUrl'],
        desired_cols
    ].dropna(axis=0, how='any').drop_duplicates()
    return_obj = [dict(zip(desired_cols, x)) for x in return_data.values.tolist()]

    return jsonify(return_obj)


@app.route('/api/v1/mquery')
def mquery():
    if (all([x in request.args for x in ['node', 'date']])):
        node = request.args['node'].lower()
        date = request.args['date']
    else:
        abort(400)

    logging.info('Processing request...')

    fail = False
    ret = {}
    try:
        node, entity_type = preprocess_node(node)
        obj = mquery_aux(node, date, entity_type)
        ret = jsonify(obj)
    except Exception as e:
        logging.info('Error: {}'.format(e))
        logging.info('Terminating process with code 500')
        fail = True

    if fail:
        abort(500)
    else:
        return ret

@app.route('/api/v1/statquery')
def stat_query():
    global refreshing, query_processes

    while refreshing:
        logging.info('query received, waiting for refresh to complete')
        sleep(0.5)

    pid = 0 if len(query_processes) == 0 else query_processes[-1] + 1
    query_processes.append(pid)

    if (all([x in request.args for x in ['node', 'date', 'dsrc_global', 'dsrc_country', 'dsrc_state', 'dsrc_county']])):
        node = request.args['node'].lower()
        date = request.args['date']
        sources = {
            'global': request.args['dsrc_global'],
            'country': request.args['dsrc_country'],
            'state': request.args['dsrc_state'],
            'county': request.args['dsrc_county'],
        }
    else:
        query_processes.remove(pid)
        logging.info(query_processes)
        abort(400)

    logging.info('Processing request...')

    fail = False
    ret = {}
    try:
        node, entity_type = preprocess_node(node)
        child_entity_type = get_children_type(entity_type)

        ret = {
            'breadcrumb': [],
            'children': [{
                'entity_type': child_entity_type,
                'name': process_names(x, child_entity_type),
                'default_stats': get_data_from_source(x, date, sources[child_entity_type], child_entity_type)
            } for x in get_children(node, entity_type)]
        }

        cur_node = node
        cur_entity_type = entity_type
        while cur_entity_type != -1:
            ret['breadcrumb'] = [{
                "entity_type": cur_entity_type,
                "name": process_names(cur_node, cur_entity_type),
                "default_stats": get_data_from_source(cur_node, date, sources[cur_entity_type], cur_entity_type)
            }] + ret['breadcrumb']

            if cur_node == node:
                ret['breadcrumb'][-1]['detailed_stats'] = get_all_data(cur_node, date, cur_entity_type)

            cur_node = get_parent(cur_node, cur_entity_type)
            cur_entity_type = get_parent_type(cur_entity_type)

        ret = jsonify(ret)
    except Exception as e:
        logging.info('Error: {}'.format(e))
        logging.info('Terminating process with code 500')
        fail = True

    query_processes.remove(pid)
    logging.info(query_processes)

    if fail:
        abort(500)
    else:
        return ret


def process_names(x, entity_type):
    if x == 'us':
        x = 'united states'

    if entity_type == 'county':
        x = '-'.join(x.split('-')[:-1])

    return '-'.join([string.capwords(z) for z in x.split('-')])


def parse_into_arrays(x):
    if not x:
        return []
    return [z.replace(',', '') for z in x.split('-')]


def get_children(node, entity_type):
    if entity_type == 'global':
        return [x.lower().strip(' \r\t\n') for x in open(os.path.join(source_list_input_prefix, 'countries.txt'), 'r')]
    elif entity_type == 'country':
        if node == "us":
            return [x.lower().strip(' \t\r\n') for x in open(os.path.join(source_list_input_prefix, 'states.txt'), 'r')]
        else:
            return []
    elif entity_type == 'state':
        ret = []
        with open(os.path.join(source_list_input_prefix, 'counties.txt'), 'r') as f:
            for line in f:
                line = line.lower().strip(' \r\t\n')
                if ',{}'.format(node) in line and not line[line.rindex(node) - 2].isdigit():
                    ret.append('{}-{}'.format(line.split(',')[1], node))
        return ret
    else:
        return []


def get_children_type(entity_type):
    return ('state' if entity_type == 'country' else ('county' if entity_type == 'state' else ('country' if entity_type == 'global' else -1)))


def get_parent_type(entity_type):
    return ('country' if entity_type == 'state' else ('state' if entity_type == 'county' else ('global' if entity_type == 'country' else -1)))


def get_parent(node, entity_type):
    if entity_type == 'county':
        with open(os.path.join(source_list_input_prefix, 'counties.txt'), 'r') as f:
            for line in f:
                line = line.lower().strip(' \r\t\n')
                if ',{},{}'.format('-'.join(node.split('-')[:-1]), node.split('-')[-1]) in line:
                    return line.split(',')[2]
            return -1
    elif entity_type == 'state':
        return 'us'
    elif entity_type == 'country':
        return 'global'
    else:
        return -1


def get_data_from_source(node, date, source, entity_type):
    def custom_search_df_for_county_node(df):
        def county_is_ok(idx, full_str, county_str):
            return idx == 0 or (full_str[idx - 1] == '-' and full_str[idx + len(county_str)] == '-')

        columns = df.columns.values.tolist()
        toks = node.split('-')
        county, state = toks[0], toks[1]

        ans = []
        for i, el in enumerate(columns):
            if county_is_ok(el.find(county), el, county) and el.rfind(state) == len(el) - len(state):
                ans.append(i)

        if len(ans) == 1:
            return ans[0]
        else:
            return -1

    if entity_type == 'global':
        if source == 'JHU':
            if date in file_list['JHU']['country'][1]:
                res = [0, 0, 0]
                has_na = [False, False, False]
                temp = file_list['JHU']['country'][0].iloc[file_list['JHU']['country'][1][date]]

                for i in range(3, len(temp)):
                    tlist = list(temp[i])

                    if tlist[0] == '-':
                        del tlist[0]
                        while tlist[0] != '-':
                            del tlist[0]
                        tlist = ['0'] + tlist
                    charidx = 0
                    while charidx < len(tlist) - 1:
                        if tlist[charidx] == tlist[charidx + 1] == '-':
                            del tlist[charidx + 1]
                            while tlist[charidx + 1] != '-':
                                del tlist[charidx + 1]
                            tlist = tlist[:charidx + 1] + ['0'] + tlist[charidx + 1:]
                        charidx += 1

                    temp[i] = ''.join(tlist)
                    for idx, el in enumerate(temp[i].split('-')):
                        if el.isdigit():
                            res[idx] += int(el)
                        else:
                            has_na[idx] = True

                return parse_into_arrays('-'.join(['NA' if x == 0 and has_na[i] else str(x) for i, x in enumerate(res)]))
            else:
                return []
        else:
            return []
    elif source != "JHU" and source != "NY Times":
        if date in file_list[source][1]:
            try:
                info = file_list[source][0].iloc[file_list[source][1][date], file_list[source][0].columns.get_loc(node)]
            except Exception as _:
                if entity_type == 'county' and source in source_list_per_level['county']:
                    idx = custom_search_df_for_county_node(file_list[source][entity_type][0])
                    if idx != -1:
                        return parse_into_arrays(file_list[source][entity_type][0].iloc[file_list[source][entity_type][1][date], idx])
                return []
            return parse_into_arrays(info)
        else:
            return []
    else:
        if date in file_list[source][entity_type][1]:
            try:
                info = file_list[source][entity_type][0].iloc[file_list[source][entity_type][1][date], file_list[source][entity_type][0].columns.get_loc(node)]
            except Exception as _:
                if entity_type == 'county' and source in source_list_per_level['county']:
                    idx = custom_search_df_for_county_node(file_list[source][entity_type][0])
                    if idx != -1:
                        return parse_into_arrays(file_list[source][entity_type][0].iloc[file_list[source][entity_type][1][date], idx])
                return []
            return parse_into_arrays(info)
        else:
            return []


# county: COUNTY, PARISH, BOROUGH
# state: contained in united-states.txt
# country: all other?
def select_entity_type(name):
    def is_state():
        with open(os.path.join(source_list_input_prefix, 'states.txt'), 'r') as f:
            for line in f:
                if line.lower().strip(' \n\r\t') == name:
                    return True
            return False

    if name == 'global':
        return 'global'
    elif any([x in name for x in ['county', 'parish', 'borough']]):
        return 'county'
    elif is_state():
        return 'state'
    else:
        return 'country'


def get_all_data(node, date, entity_type):
    ret = {}

    for source in source_list_per_level[entity_type]:
        cur = get_data_from_source(node, date, source, entity_type)
        if cur != []:
            ret[source] = cur

    return ret


def get_delim(p):
    delim = ','
    with open(p, 'r') as f:
        if '\t' in f.read():
            delim = '\t'
    return delim

def prc(v):
    path = os.path.join(source_list_output_prefix, v)

    delim = get_delim(path)

    logging.info('loading {}'.format(path))

    df = pandas.read_csv(path, sep=delim)
    df.columns = df.columns.str.lower()
    dates = {}
    for i, el in enumerate(df[df.columns[0]]):
        dates[el] = i

    logging.info(dates)

    return (df, dates)

def locate_twitter_data():
    files = []
    for f in os.listdir(misinformation_panel_source):
        if reduce(lambda acc, it: acc and it, map( lambda s: s in f, ['ennonrt', 'stnc_dtctn', '.csv'] )):
          p = os.path.join(misinformation_panel_source, f)
          logging.info(f"Located twitter data file [{p}]")
          files.append(p)
    return files

def refresh_data_util():
    global twitter_data, twitter_data_file_list
    for key, value in source_list.items():
        if key != 'JHU' and key != 'NY Times':
            file_list[key] = prc(value)
        else:
            file_list[key] = {}
            for subkey, subvalue in source_list[key].items():
                file_list[key][subkey] = prc(subvalue)

    twitter_data_file_list = locate_twitter_data()
    def read_data(p):
        delim = get_delim(p)
        logging.info('loading {}'.format(p))
        return pd.read_csv(p, sep=delim)
    twitter_data = pd.concat([read_data(p) for p in twitter_data_file_list])
    print("ok")


def refresh_data():
    global refreshing, query_processes

    while len(query_processes) > 0:
        logging.info('waiting to refresh, query_processes={}'.format(query_processes))
        sleep(0.5)

    refreshing = True
    logging.info('{}: starting refresh'.format(datetime.now()))

    clear_cached_data()
    refresh_data_util()

    Timer(int(refresh_interval_hrs * 3600), refresh_data).start()
    logging.info('{}: refresh complete'.format(datetime.now()))

    refreshing = False


if __name__ == "__main__":
    logging.set_verbosity(logging.INFO)
    refresh_data()
    coord.load_coords()
    app.run(host="0.0.0.0", port=port, threaded=True, debug=False, use_reloader=False)
