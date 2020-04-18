from flask import Flask, request, jsonify, render_template, Blueprint, abort
from flask_cors import CORS
from threading import Timer
from time import sleep
from datetime import datetime
from absl import logging
from datetime import date, timedelta, datetime
import sys
import os
import pandas
import string

app = Flask(__name__)
CORS(app)

file_list = {}
source_list_prefix = '../../covid19data/COVID_data_collection/data/'
source_list = {
    'CDC': 'cdc_time_series.csv',  # state
    'CNN': 'cnn_time_series.csv',  # state
    'COVID Tracking Project': 'COVIDTrackingProject_time_series.csv',  # state
    'NY Times': 'NYtimes_time_series.csv',  # state
    'JHU': {
        'country': 'JHU_global_time_series.csv',  # country and province
        'state': 'johns_hopkins_states_time_series.csv',  # state
        'county': 'johns_hopkins_counties_time_series.csv',  # county
    }
}
source_list_per_level = {
    'global': ['JHU'],
    'country': ['JHU'],
    'state': ['CDC', 'CNN', 'COVID Tracking Project', 'NY Times', 'JHU'],
    'county': ['JHU']
}

refresh_interval_hrs = 1
refreshing = False
query_processes = []


def clear_cached_data():
    file_list.clear()


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

    query_processes.remove(pid)
    logging.info(query_processes)

    if ret == {}:
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

    ret = {}
    try:
        node, entity_type = preprocess_node(node)
        ret = jsonify(get_all_data(node, date, entity_type))
    except Exception as e:
        logging.info('Error: {}'.format(e))
        logging.info('Terminating process with code 500')

    query_processes.remove(pid)
    logging.info(query_processes)

    if ret == {}:
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

    query_processes.remove(pid)
    logging.info(query_processes)

    if ret == {}:
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
        return [x.lower().strip(' \r\t\n') for x in open(os.path.join(source_list_prefix, 'countries.txt'), 'r')]
    elif entity_type == 'country':
        if node == "us":
            return [x.lower().strip(' \t\r\n') for x in open(os.path.join(source_list_prefix, 'states.txt'), 'r')]
        else:
            return []
    elif entity_type == 'state':
        ret = []
        with open(os.path.join(source_list_prefix, 'counties.txt'), 'r') as f:
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
        with open(os.path.join(source_list_prefix, 'counties.txt'), 'r') as f:
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
    elif source != "JHU":
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
        with open(os.path.join(source_list_prefix, 'states.txt'), 'r') as f:
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


def refresh_data_util():
    def prc(v):
        path = os.path.join(source_list_prefix, v)

        delim = ','
        with open(path, 'r') as f:
            if '\t' in f.read():
                delim = '\t'

        logging.info('loading {}'.format(path))

        df = pandas.read_csv(path, sep=delim)
        df.columns = df.columns.str.lower()
        dates = {}
        for i, el in enumerate(df[df.columns[0]]):
            dates[el] = i

        logging.info(dates)

        return (df, dates)

    for key, value in source_list.items():
        if key != 'JHU':
            file_list[key] = prc(value)
        else:
            file_list[key] = {}
            for subkey, subvalue in source_list[key].items():
                file_list[key][subkey] = prc(subvalue)


def clear_api_logs(loc='./api.log'):
    if os.path.isfile(loc):
        os.remove(loc)


def refresh_data():
    global refreshing, query_processes

    while len(query_processes) > 0:
        logging.info('waiting to refresh, query_processes={}'.format(query_processes))
        sleep(0.5)

    refreshing = True
    logging.info('{}: starting refresh'.format(datetime.now()))

    clear_api_logs()
    clear_cached_data()
    refresh_data_util()

    Timer(int(refresh_interval_hrs * 3600), refresh_data).start()
    logging.info('{}: refresh complete'.format(datetime.now()))

    refreshing = False


if __name__ == "__main__":
    logging.set_verbosity(logging.INFO)
    refresh_data()
    port = 2222 if not len(sys.argv) > 1 else int(sys.argv[1])
    app.run(host="0.0.0.0", port=port, threaded=True, debug=False, use_reloader=False)
