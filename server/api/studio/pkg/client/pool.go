package client

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/facebook/fbthrift/thrift/lib/go/thrift"
	nebula "github.com/vesoft-inc/nebula-ng-tools/golang"
	"github.com/zeromicro/go-zero/core/logx"
)

type ParsedResult struct {
	Headers     []string         `json:"headers"`
	Tables      []map[string]Any `json:"tables"`
	TimeCost    int64            `json:"timeCost"`
	LocalParams ParameterMap     `json:"localParams"`
	Space       string           `json:"space"`
}
type ExecuteResult struct {
	Gql    string
	Result ParsedResult
	Error  error
}

type Any interface{}

type list []Any

func isThriftProtoError(err error) bool {
	protoErr, ok := err.(thrift.ProtocolException)
	if !ok {
		return false
	}
	if protoErr.TypeID() != thrift.UNKNOWN_PROTOCOL_EXCEPTION {
		return false
	}
	errPrefix := []string{"wsasend", "wsarecv", "write:"}
	errStr := protoErr.Error()
	for _, e := range errPrefix {
		if strings.Contains(errStr, e) {
			return true
		}
	}
	return false
}

func isThriftTransportError(err error) bool {
	if transErr, ok := err.(thrift.TransportException); ok {
		typeId := transErr.TypeID()
		if typeId == thrift.UNKNOWN_TRANSPORT_EXCEPTION || typeId == thrift.TIMED_OUT {
			if strings.Contains(transErr.Error(), "read:") {
				return true
			}
		}
	}
	return false
}

func transformError(err error) error {
	if isThriftProtoError(err) || isThriftTransportError(err) {
		return ConnectionClosedError
	}
	return err
}

func getValue(valWarp *nebula.ValueWrapper) (Any, error) {
	switch valWarp.GetType() {
	// case "vertex", "edge", "path", "list", "map", "set":
	// 	return valWarp.String(), nil
	default:
		return getBasicValue(valWarp)
	}
}

func getBasicValue(valWarp *nebula.ValueWrapper) (Any, error) {
	valType := valWarp.GetType()
	if valType == "bool" {
		return valWarp.AsBool()
	} else if valType == "int8" || valType == "int16" || valType == "int32" || valType == "int64" || strings.Contains(valType, "int") {
		return valWarp.AsInt64()
	} else if valType == "float" || valType == "double" {
		return valWarp.AsFloat()
	} else if valType == "string" {
		return valWarp.AsString()
	} else if valType == "date" {
		return valWarp.AsDate()
	} else if valType == "localTime" {
		return valWarp.AsLocalTime()
	} else if valType == "localDatetime" {
		return valWarp.AsLocalDatetime()
	} else if valType == "duration" {
		return valWarp.AsDuration()
	} else if valType == "path" {
		return valWarp.AsPath()
	} else if valType == "geography" {
		return valWarp.String(), nil
	} else if valType == "empty" {
		return "_EMPTY_", nil
	}
	return valWarp.String(), nil
}

func getID(idWarp nebula.ValueWrapper) Any {
	idType := idWarp.GetType()
	var vid Any
	if idType == "string" {
		vid, _ = idWarp.AsString()
	} else if idType == "int" {
		vid, _ = idWarp.AsInt64()
	}
	return vid
}

func getVertexInfo(valWarp *nebula.ValueWrapper, data map[string]Any) (map[string]Any, error) {
	node, err := valWarp.AsNode()
	if err != nil {
		return nil, err
	}
	data["vid"] = node.GetID()
	properties := make(map[string]Any)

	for key, value := range node.GetProperties() {
		val, err := getBasicValue(value)
		if err != nil {
			return nil, err
		}
		properties[key] = val
	}
	data["type"] = node.GetRawNode().GetNodeTypeID()
	data["properties"] = properties
	return data, nil
}

func getEdgeInfo(valWarp *nebula.ValueWrapper, data map[string]Any) (map[string]Any, error) {
	// relationship, err := valWarp.AsEdge()
	// if err != nil {
	// 	return nil, err
	// }
	// srcID := relationship.GetSrcVertexID()
	// data["srcID"] = getID(srcID)
	// dstID := relationship.GetDstVertexID()
	// data["dstID"] = getID(dstID)
	// edgeName := relationship.GetEdgeName()
	// data["edgeName"] = edgeName
	// rank := relationship.GetRanking()
	// data["rank"] = rank
	// properties := make(map[string]Any)
	// props := relationship.Properties()
	// for k, v := range props {
	// 	value, err := getValue(v)
	// 	if err != nil {
	// 		return nil, err
	// 	}
	// 	properties[k] = value
	// }
	// data["properties"] = properties
	return data, nil
}

func getPathInfo(valWarp *nebula.ValueWrapper, data map[string]Any) (map[string]Any, error) {
	// path, err := valWarp.AsPath()
	// if err != nil {
	// 	return nil, err
	// }
	// relationships := path.GetRelationships()
	// var _relationships []Any
	// for _, relation := range relationships {
	// 	_relation := make(map[string]Any)
	// 	srcID := relation.GetSrcVertexID()
	// 	_relation["srcID"] = getID(srcID)
	// 	dstID := relation.GetDstVertexID()
	// 	_relation["dstID"] = getID(dstID)
	// 	edgeName := relation.GetEdgeName()
	// 	_relation["edgeName"] = edgeName
	// 	rank := relation.GetRanking()
	// 	_relation["rank"] = rank
	// 	_relationships = append(_relationships, _relation)
	// }
	// data["relationships"] = _relationships
	// if len(relationships) == 0 {
	// 	nodes := path.GetNodes()
	// 	if len(nodes) > 0 {
	// 		startNode := nodes[0]
	// 		data["srcID"] = getID(startNode.GetID())
	// 	}
	// }
	return data, nil
}

func getListInfo(valWarp *nebula.ValueWrapper, listType string, _verticesParsedList *list, _edgesParsedList *list, _pathsParsedList *list) error {
	// var valueList []nebula.ValueWrapper
	// var err error
	// if listType == "list" {
	// 	valueList, err = valWarp.AsList()
	// } else if listType == "set" {
	// 	valueList, err = valWarp.AsDedupList()
	// }
	// if err != nil {
	// 	return err
	// }
	// for _, v := range valueList {
	// 	props := make(map[string]Any)
	// 	vType := v.GetType()
	// 	props["type"] = vType
	// 	if vType == "vertex" {
	// 		props, err = getVertexInfo(&v, props)
	// 		if err == nil {
	// 			*_verticesParsedList = append(*_verticesParsedList, props)
	// 		} else {
	// 			return err
	// 		}
	// 	} else if vType == "edge" {
	// 		props, err = getEdgeInfo(&v, props)
	// 		if err == nil {
	// 			*_edgesParsedList = append(*_edgesParsedList, props)
	// 		} else {
	// 			return err
	// 		}
	// 	} else if vType == "path" {
	// 		props, err = getPathInfo(&v, props)
	// 		if err == nil {
	// 			*_pathsParsedList = append(*_pathsParsedList, props)
	// 		} else {
	// 			return err
	// 		}
	// 	} else if vType == "list" {
	// 		err = getListInfo(&v, "list", _verticesParsedList, _edgesParsedList, _pathsParsedList)
	// 		if err != nil {
	// 			return err
	// 		}
	// 	} else if vType == "map" {
	// 		err = getMapInfo(&v, _verticesParsedList, _edgesParsedList, _pathsParsedList)
	// 		if err != nil {
	// 			return err
	// 		}
	// 	} else if vType == "set" {
	// 		err = getListInfo(&v, "set", _verticesParsedList, _edgesParsedList, _pathsParsedList)
	// 		if err != nil {
	// 			return err
	// 		}
	// 	} else {
	// 		// no need to parse basic value now
	// 	}
	// }
	return nil
}

func getMapInfo(valWarp *nebula.ValueWrapper, _verticesParsedList *list, _edgesParsedList *list, _pathsParsedList *list) error {
	valueMap, err := valWarp.AsMap()
	if err != nil {
		return err
	}
	for _, v := range valueMap {
		vType := v.GetType()
		if vType == "vertex" {
			_props := make(map[string]Any)
			_props, err = getVertexInfo(&v, _props)
			if err == nil {
				*_verticesParsedList = append(*_verticesParsedList, _props)
			} else {
				return err
			}
		} else if vType == "edge" {
			_props := make(map[string]Any)
			_props, err = getEdgeInfo(&v, _props)
			if err == nil {
				*_edgesParsedList = append(*_edgesParsedList, _props)
			} else {
				return err
			}
		} else if vType == "path" {
			_props := make(map[string]Any)
			_props, err = getPathInfo(&v, _props)
			if err == nil {
				*_pathsParsedList = append(*_pathsParsedList, _props)
			} else {
				return err
			}
		} else if vType == "list" {
			err = getListInfo(&v, "list", _verticesParsedList, _edgesParsedList, _pathsParsedList)
			if err != nil {
				return err
			}
		} else if vType == "map" {
			err = getMapInfo(&v, _verticesParsedList, _edgesParsedList, _pathsParsedList)
			if err != nil {
				return err
			}
		} else if vType == "set" {
			err = getListInfo(&v, "set", _verticesParsedList, _edgesParsedList, _pathsParsedList)
			if err != nil {
				return err
			}
		} else {
			// no need to parse basic value now
		}
	}
	return nil
}

func (client *Client) handleRequest(nsid string) {
	for {
		select {
		case request := <-client.RequestChannel:
			go func() {
				defer func() {
					if err := recover(); err != nil {
						logx.Errorf("[handle request]: %s, %+v", request.Gqls, err)
						request.ResponseChannel <- ChannelResponse{
							Results: nil,
							Msg:     err,
							Error:   SessionLostError,
						}
					}
				}()

				for {
					var err error
					session, err := client.getSession()
					if err != nil {
						request.ResponseChannel <- ChannelResponse{
							Results: nil,
							Error:   err,
						}
						return
					}
					if session == nil {
						// session create failed, bug still has active session, so wait for a while
						time.Sleep(time.Millisecond * 500)
						continue
					}
					defer client.sessionPool.addSession(session)
					client.executeRequest(session, request)
					break
				}
			}()
		case <-client.CloseChannel:
			client.sessionPool.clearSessions()
			clientPool.Delete(nsid)
			return // Exit loop
		}
	}
}

func (client *Client) executeRequest(session *nebula.Session, request ChannelRequest) {
	parameterMap := client.parameterMap
	result := make([]SingleResponse, 0)
	spaceGQL := ""
	// add use space before execute
	if request.Space != "" {
		space := strings.Replace(request.Space, "\\", "\\\\", -1)
		space = strings.Replace(space, "`", "\\`", -1)
		spaceGQL = fmt.Sprintf("USE `%s` ", space)
	}

	for _, gql := range request.Gqls {
		isLocal, cmd, args := isClientCmd(gql)
		if isLocal {
			showMap, err := executeClientCmd(cmd, args, parameterMap)
			if err != nil {
				result = append(result, SingleResponse{
					Gql:    gql,
					Error:  err,
					Result: nil,
				})
			} else if cmd != 3 {
				// sleep dont need to return result
				result = append(result, SingleResponse{
					Error:  nil,
					Result: nil,
					Params: showMap,
					Gql:    gql,
				})
			}
		} else {
			execResponse, err := session.Execute(fmt.Sprintf("%s %s", spaceGQL, gql))
			if err != nil {
				result = append(result, SingleResponse{
					Gql:    gql,
					Error:  transformError(err),
					Result: nil,
				})
			} else {
				result = append(result, SingleResponse{
					Gql:    gql,
					Error:  nil,
					Result: execResponse,
				})
			}
		}
	}

	request.ResponseChannel <- ChannelResponse{
		Results: result,
		Error:   nil,
	}
}

func Execute(nsid string, space string, gqls []string) ([]ExecuteResult, error) {
	client, _ := clientPool.Get(nsid)
	if client == nil {
		return nil, ClientNotExistedError
	}
	responseChannel := make(chan ChannelResponse)
	client.RequestChannel <- ChannelRequest{
		Gqls:            gqls,
		Space:           space,
		ResponseChannel: responseChannel,
	}
	response := <-responseChannel

	res := make([]ExecuteResult, 0)
	if response.Error != nil {
		return nil, response.Error
	}

	results := response.Results
	for _, resp := range results {
		result, err := parseExecuteData(resp)
		res = append(res, ExecuteResult{
			Gql:    resp.Gql,
			Result: result,
			Error:  err,
		})
	}
	return res, nil
}

func parseExecuteData(response SingleResponse) (ParsedResult, error) {
	result := ParsedResult{
		Headers:     make([]string, 0),
		Tables:      make([]map[string]Any, 0),
		LocalParams: nil,
	}
	if len(response.Params) > 0 {
		result.LocalParams = response.Params
	}

	if response.Error != nil {
		return result, response.Error
	}
	res := response.Result
	if response.Result == nil {
		return result, nil
	}

	if !res.IsSucceed() {
		return result, errors.New(res.GetStatus())
	}
	if res.IsSetPlanDesc() {
		resp := response.Result
		if response.Result == nil {
			return result, nil
		}
		format := resp.GetPlanDesc()
		result.Headers = []string{"key", "value"}
		for key, value := range format {
			rowValue := make(map[string]Any)
			rowValue["key"] = key
			rowValue["value"] = value
			result.Tables = append(result.Tables, rowValue)
		}
		return result, nil
	}
	if res.IsSucceed() {
		rows := res.GetRows()
		rowSize := len(rows)
		colSize := res.GetColSize()
		colNames := res.GetColNames()
		result.Headers = colNames

		for i := 0; i < rowSize; i++ {
			rowValue := make(map[string]Any)
			_verticesParsedList := make(list, 0)
			_edgesParsedList := make(list, 0)
			_pathsParsedList := make(list, 0)

			for j := 0; j < colSize; j++ {
				record, err := res.GetRowValuesByIndex(i)
				if err != nil {
					return result, err
				}
				rowData, err := record.GetValueByIndex(j)
				if err != nil {
					return result, err
				}
				value, err := getValue(rowData)
				if err != nil {
					return result, err
				}
				rowValue[result.Headers[j]] = value
				valueType := rowData.GetType()
				if valueType == "node" {
					parseValue := make(map[string]Any)
					parseValue, err = getVertexInfo(rowData, parseValue)
					parseValue["type"] = "vertex"
					_verticesParsedList = append(_verticesParsedList, parseValue)
				} else if valueType == "edge" {
					parseValue := make(map[string]Any)
					parseValue, err = getEdgeInfo(rowData, parseValue)
					parseValue["type"] = "edge"
					_edgesParsedList = append(_edgesParsedList, parseValue)
				} else if valueType == "path" {
					parseValue := make(map[string]Any)
					parseValue, err = getPathInfo(rowData, parseValue)
					parseValue["type"] = "path"
					_pathsParsedList = append(_pathsParsedList, parseValue)
				} else if valueType == "list" {
					err = getListInfo(rowData, "list", &_verticesParsedList, &_edgesParsedList, &_pathsParsedList)
				} else if valueType == "set" {
					err = getListInfo(rowData, "set", &_verticesParsedList, &_edgesParsedList, &_pathsParsedList)
				} else if valueType == "map" {
					err = getMapInfo(rowData, &_verticesParsedList, &_edgesParsedList, &_pathsParsedList)
				}
				if len(_verticesParsedList) > 0 {
					rowValue["_verticesParsedList"] = _verticesParsedList
				}
				if len(_edgesParsedList) > 0 {
					rowValue["_edgesParsedList"] = _edgesParsedList
				}
				if len(_pathsParsedList) > 0 {
					rowValue["_pathsParsedList"] = _pathsParsedList
				}
				if err != nil {
					return result, err
				}
			}
			result.Tables = append(result.Tables, rowValue)
		}
	}
	result.TimeCost = res.GetLatency()
	// result.Space = res.GetSpaceName()
	return result, nil
}
