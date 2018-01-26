import thunk from 'redux-thunk';
import { step } from 'mocha-steps';
import { expect } from 'chai';
import { mount } from 'enzyme';
import { stub, match } from 'sinon';

import * as peers from '../../src/utils/api/peers';
import { prepareStore, renderWithRouter } from '../utils/applicationInit';
import accountReducer from '../../src/store/reducers/account';
import transactionReducer from '../../src/store/reducers/transactions';
import peersReducer from '../../src/store/reducers/peers';
import loginMiddleware from '../../src/store/middlewares/login';
import accountMiddleware from '../../src/store/middlewares/account';
import transactionsMiddleware from '../../src/store/middlewares/transactions';
import { accountLoggedIn } from '../../src/actions/account';
import AccountTransactions from './../../src/components/accountTransactions';
import accounts from '../constants/accounts';
import { click, containsMessage } from './steps';

describe('@integration: Account Transactions', () => {
  let store;
  let wrapper;
  let requestToActivePeerStub;

  const successMessage = 'Transaction is being processed and will be confirmed. It may take up to 15 minutes to be secured in the blockchain.';
  const errorMessage = 'An error occurred while creating the transaction.';

  beforeEach(() => {
    requestToActivePeerStub = stub(peers, 'requestToActivePeer');
    const transactionExample = { senderId: 'sample_address', receiverId: 'some_address' };

    requestToActivePeerStub.withArgs(match.any, 'transactions', match({
      recipientId: '537318935439898807L',
      amount: 1e8,
      secret: match.any,
      secondSecret: match.any,
    }))
      .returnsPromise().resolves({ transactionId: 'Some ID' });

    // specific address
    let transactions = new Array(20);
    transactions.fill(transactionExample);
    requestToActivePeerStub.withArgs(match.any, 'transactions', match({ senderId: '123L', recipientId: '123L' }))
      .returnsPromise().resolves({ transactions, count: 1000 });

    // incoming transaction result
    transactions = new Array(15);
    transactions.fill(transactionExample);
    requestToActivePeerStub.withArgs(match.any, 'transactions', match({ senderId: undefined }))
      .returnsPromise().resolves({ transactions, count: 1000 });

    // outgoing transaction result
    transactions = new Array(5);
    transactions.fill(transactionExample);
    requestToActivePeerStub.withArgs(match.any, 'transactions', match({ recipientId: undefined }))
      .returnsPromise().resolves({ transactions, count: 1000 });
  });

  afterEach(() => {
    requestToActivePeerStub.restore();
    wrapper.update();
  });

  const setupStep = ({ accountType, isLocked = false, address }) => {
    store = prepareStore({
      account: accountReducer,
      transactions: transactionReducer,
      peers: peersReducer,
    }, [
      thunk,
      accountMiddleware,
      loginMiddleware,
      transactionsMiddleware,
    ]);

    const passphrase = isLocked ? undefined : accounts[accountType].passphrase;
    const account = {
      ...accounts[accountType],
      delegate: {},
      multisignatures: [],
      u_multisignatures: [],
      unconfirmedBalance: '0',
      passphrase,
    };

    store.dispatch(accountLoggedIn(account));
    wrapper = mount(renderWithRouter(AccountTransactions, store, { match:
      { params: { address } },
    }));
  };

  const fillInputField = (value, field) => {
    wrapper.find(`.${field} input`).first().simulate('change', { target: { value } });
  };

  const clickStep = (elementName) => {
    click(wrapper, elementName);
  };

  const shouldContainMessage = (elementName, message) => {
    containsMessage(wrapper, elementName, message);
  };

  const checkRowCount = (length) => {
    expect(wrapper.find('TransactionRow')).to.have.length(length);
  };

  const checkSelectedFilter = (filter) => {
    const expectedClass = '_active';

    const activeFilter = wrapper.find('.transaction-filter-item').filterWhere((item) => {
      const className = item.prop('className');
      return className.includes(expectedClass);
    });

    expect(activeFilter.text().toLowerCase()).to.equal(filter);
  };

  describe('Send', () => {
    describe('Scenario: should not allow to send when not enough funds', () => {
      step('Given I\'m on "wallet" as "empty account"', setupStep.bind(null, { accountType: 'empty account' }));
      step('And I fill in "1" to "amount" field', fillInputField.bind(null, '1', 'amount'));
      step('And I fill in "537318935439898807L" to "recipient" field', fillInputField.bind(null, '537318935439898807L', 'recipient'));
      step('Then I should see "Insufficient funds" error message', () => {
        expect(wrapper.find('Input').at(1).html()).to.contain('Insufficient funds');
      });
      step('And "send next button" should be disabled', () => {
        expect(wrapper.find('.send-next-button button').filterWhere(item => item.prop('disabled') === true)).to.have.lengthOf(1);
      });
    });

    describe('Scenario: should give and error message when sending fails', () => {
      step('Given I\'m on "wallet" as "genesis" account', setupStep.bind(null, { accountType: 'genesis' }));
      step('And I fill in "1" to "amount" field', fillInputField.bind(null, '1', 'amount'));
      step('And I fill in "537318935439898807L" to "recipient" field', fillInputField.bind(null, '537318935439898807L', 'recipient'));
      step('And I click "send next button"', clickStep.bind(null, 'send next button'));
      step('When I click "send button"', () => {
        requestToActivePeerStub.withArgs(match.any, 'transactions', match.any).returnsPromise().rejects({});
        wrapper.find('.send-button button').simulate('click');
      });
      step(`Then I should see text ${errorMessage} in "result box message" element`, shouldContainMessage.bind(this, 'result box message', errorMessage));
    });

    describe('Scenario: should allow to send LSK from unlocked account', () => {
      step('Given I\'m on "wallet" as "genesis" account', setupStep.bind(null, { accountType: 'genesis' }));
      step('And I fill in "1" to "amount" field', fillInputField.bind(null, '1', 'amount'));
      step('And I fill in "537318935439898807L" to "recipient" field', fillInputField.bind(null, '537318935439898807L', 'recipient'));
      step('And I click "send next button"', clickStep.bind(null, 'send next button'));
      step('When I click "send button"', () => { wrapper.find('.send-button button').simulate('click'); });
      step(`Then I should see text ${successMessage} in "result box message" element`, shouldContainMessage.bind(this, 'result box message', successMessage));
    });

    describe('Scenario: should allow to send LSK from locked account', () => {
      const { passphrase } = accounts.genesis;
      step('Given I\'m on "wallet" as "genesis" account', setupStep.bind(null, { accountType: 'genesis', isLocked: true }));
      step('And I fill in "1" to "amount" field', fillInputField.bind(null, '1', 'amount'));
      step('And I fill in "537318935439898807L" to "recipient" field', fillInputField.bind(null, '537318935439898807L', 'recipient'));
      step('And I click "send next button"', clickStep.bind(null, 'send next button'));
      step('And I fill in passphrase of "genesis" to "passphrase" field', fillInputField.bind(null, passphrase, 'passphrase'));
      step('When I click "next button"', () => { wrapper.find('.first-passphrase-next button').simulate('click'); });
      step('When I click "send button"', () => { wrapper.find('.send-button button').simulate('click'); });
      step(`Then I should see text ${successMessage} in "result box message" element`, shouldContainMessage.bind(this, 'result box message', successMessage));
    });

    describe('Scenario: should allow to send LSK from unlocked account with 2nd passphrase', () => {
      const { secondPassphrase } = accounts['second passphrase account'];
      step('Given I\'m on "wallet" as "second passphrase account"', setupStep.bind(null, { accountType: 'second passphrase account' }));
      step('And I fill in "1" to "amount" field', fillInputField.bind(null, '1', 'amount'));
      step('And I fill in "537318935439898807L" to "recipient" field', fillInputField.bind(null, '537318935439898807L', 'recipient'));
      step('And I click "send next button"', clickStep.bind(null, 'send next button'));
      step('And I fill in second passphrase of "second passphrase account" to "second passphrase" field', fillInputField.bind(null, secondPassphrase, 'second-passphrase'));
      step('When I click "next button"', () => { wrapper.find('.second-passphrase-next button').simulate('click'); });
      step('When I click "send button"', () => { wrapper.find('.send-button button').simulate('click'); });
      step(`Then I should see text ${successMessage} in "result box message" element`, shouldContainMessage.bind(this, 'result box message', successMessage));
    });

    describe('Scenario: should allow to send LSK from locked account with 2nd passphrase', () => {
      const { secondPassphrase, passphrase } = accounts['second passphrase account'];
      step('Given I\'m on "wallet" as "second passphrase account"', setupStep.bind(null, { accountType: 'second passphrase account', isLocked: true }));
      step('And I fill in "1" to "amount" field', fillInputField.bind(null, '1', 'amount'));
      step('And I fill in "537318935439898807L" to "recipient" field', fillInputField.bind(null, '537318935439898807L', 'recipient'));
      step('And I click "send next button"', clickStep.bind(null, 'send next button'));
      step('And I fill in passphrase of "second passphrase account" to "passphrase" field', fillInputField.bind(null, passphrase, 'passphrase'));
      step('When I click "next button"', () => { wrapper.find('.first-passphrase-next button').simulate('click'); });
      step('And I fill in second passphrase of "second passphrase account" to "second passphrase" field', fillInputField.bind(null, secondPassphrase, 'second-passphrase'));
      step('When I click "next button"', () => { wrapper.find('.second-passphrase-next button').simulate('click'); });
      step('When I click "send button"', () => { wrapper.find('.send-button button').simulate('click'); });
      step(`Then I should see text ${successMessage} in "result box message" element`, shouldContainMessage.bind(this, 'result box message', successMessage));
    });
  });

  describe('Transactions', () => {
    describe('Scenario: should allow to view transactions of any account', () => {
      step('Given I\'m on "accounts/123L" as "genesis" account', setupStep.bind(null, { accountType: 'genesis', address: '123L' }));
      step('Then I should see 3 transaction rows as result of the address 123L', checkRowCount.bind(null, 20));
    });

    describe('Scenario: should allow to filter transactions', () => {
      step('Given I\'m on "wallet" as "genesis" account', setupStep.bind(null, { accountType: 'genesis', address: '123L' }));
      step('Then the "All" filter should be selected by default', checkSelectedFilter.bind(null, 'all'));
      step('When I click on the "Outgoing" filter', clickStep.bind(null, 'filter out'));
      step('Then I expect to see the results for "Outgoing"', checkRowCount.bind(null, 5));
      step('When I click on the "Incoming" filter', clickStep.bind(null, 'filter in'));
      step('Then I expect to see the results for "Incoming"', checkRowCount.bind(null, 15));
      step('When I click again on the "All" filter', clickStep.bind(null, 'filter all'));
      step('Then I expect to see the results for "All"', checkRowCount.bind(null, 20));
    });

    describe.skip('Scenario: should allow to search transactions');
  });
});
