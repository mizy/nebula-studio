package client

import (
	"errors"
	"fmt"
	"time"

	nebula "github.com/vesoft-inc/nebula-ng-tools/golang"
	"github.com/vesoft-inc/nebula-studio/server/api/studio/pkg/base"
	"github.com/vesoft-inc/nebula-studio/server/api/studio/pkg/utils"
	"github.com/zeromicro/go-zero/core/logx"
)

var (
	ConnectionClosedError = errors.New("an existing connection was forcibly closed, please check your network")
	SessionLostError      = errors.New("the connection session was lost, please connect again")
	ClientNotExistedError = errors.New("get client error: client not existed, session expired")
)

const (
	clientRecycleNum             = 30
	clientMaxNum                 = 200
	SessionExpiredDuration int64 = 3600
)

type Account struct {
	username string
	password string
	host     nebula.HostAddress
}

type ChannelResponse struct {
	Results []SingleResponse
	Msg     interface{}
	Error   error
}

type SingleResponse struct {
	Gql    string
	Result *nebula.ResultSet
	Params ParameterMap
	Msg    interface{}
	Error  error
}

type ChannelRequest struct {
	Gqls            []string
	ResponseChannel chan ChannelResponse
	Space           string
}

type Client struct {
	IdentifierID   int64
	RequestChannel chan ChannelRequest
	CloseChannel   chan bool
	updateTime     int64
	parameterMap   ParameterMap
	account        *Account
	sessionPool    *SessionPool
}

type ClientInfo struct {
	ClientID string
}

var clientPool = utils.NewMutexMap[*Client]()

var log = newNebulaLogger()

func NewClient(address string, port int, username string, password string, conf any) (*ClientInfo, error) {
	var err error

	// TODO: it's better to add a schedule to make it instead
	currentClientNum := clientPool.Size()
	if currentClientNum > clientRecycleNum {
		go recycleClients()
		if currentClientNum >= clientMaxNum {
			return nil, errors.New("there is no idle connection now, please try it later")
		}
	}
	hostAddress := nebula.HostAddress{Host: address, Port: port}
	connection := nebula.NewConnection(hostAddress)
	err = connection.Open(hostAddress, base.GraphServiceTimeout, nil)
	if err != nil {
		logx.Errorf("[Init connection pool error]: %+v", err)
		return nil, err
	}
	authResp, err := connection.Authenticate(username, password)
	if err != nil {
		logx.Errorf("[Authenticate error]: %+v", err)
		return nil, err
	}
	if string(authResp.GetGqlStatus().Status) != "SUCCESS" {
		logx.Errorf("[Authenticate error]: %+v", authResp.GetGqlStatus().Status)
		return nil, errors.New(string(authResp.GetGqlStatus().Status))
	}

	id := authResp.GetIdentifier()
	nsid := fmt.Sprintf("%d", id)
	client := &Client{
		IdentifierID:   id,
		RequestChannel: make(chan ChannelRequest),
		CloseChannel:   make(chan bool),
		updateTime:     time.Now().Unix(),
		parameterMap:   make(ParameterMap),
		account: &Account{
			username: username,
			password: password,
			host:     hostAddress,
		},
		sessionPool: &SessionPool{
			activeSessions: make([]*nebula.Session, 0),
			ildeSessions:   make([]*nebula.Session, 0),
		},
	}
	session := nebula.NewSession(client.IdentifierID, connection, log)
	if err != nil {
		CloseClient(nsid)
		return nil, err
	}
	client.sessionPool.addSession(session)

	clientPool.Set(nsid, client)

	go client.handleRequest(nsid)

	info := &ClientInfo{
		ClientID: nsid,
	}
	return info, err
}

func GetClient(nsid string) (*Client, error) {
	if client, ok := clientPool.Get(nsid); ok {
		client.updateTime = time.Now().Unix()
		return client, nil
	}

	return nil, ClientNotExistedError
}

func CloseClient(nsid string) {
	client, _ := clientPool.Get(nsid)
	if client != nil {
		client.CloseChannel <- true
		clientPool.Delete(nsid)
	}
}

func ClearClients() {
	clientPool.ForEach(func(key string, client *Client) {
		client.sessionPool.clearSessions()
	})
	clientPool.Clear()
}

func recycleClients() {
	now := time.Now().Unix()
	clientPool.ForEach(func(key string, client *Client) {
		expireAt := client.updateTime + SessionExpiredDuration
		if now > expireAt {
			client.CloseChannel <- true
		}
	})
}

func FindNSIDByAuthData(address string, port int, username string, password string) string {
	nsid := ""
	clientPool.ForEach(func(key string, client *Client) {
		if client.account.username == username && client.account.password == password && client.account.host.Host == address && client.account.host.Port == port {
			nsid = key
		}
	})
	return nsid
}
