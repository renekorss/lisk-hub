import React from 'react';
import grid from 'flexboxgrid/dist/flexboxgrid.css';
import Dropdown from 'react-toolbox/lib/dropdown';
import i18next from 'i18next';
import { FontIcon } from '../fontIcon';
import Parallax from '../parallax';
import Input from '../toolbox/inputs/input';
import { PrimaryButton } from '../toolbox/buttons/button';
import { extractAddress } from '../../utils/api/account';
import PassphraseInput from '../passphraseInput';
import styles from './login.css';
import env from '../../constants/env';
import networks from '../../constants/networks';
import getNetwork from '../../utils/getNetwork';
import { parseSearchParams } from './../../utils/searchParams';
import LanguageDropdown from '../languageDropdown';
import RelativeLink from '../relativeLink';
// eslint-disable-next-line import/no-unresolved
import * as shapes from '../../assets/images/*.svg';
import { validateUrl, getLoginData } from '../../utils/login';

/**
 * The container component containing login
 * and create account functionality
 */
class Login extends React.Component {
  constructor() {
    super();

    this.state = {
      passphrase: '',
      address: '',
      network: networks.mainnet.code,
    };

    this.validators = {
      address: validateUrl,
      passphrase: this.validatePassphrase.bind(this),
    };
  }

  componentWillMount() {
    this.getNetworksList();
    i18next.on('languageChanged', () => {
      this.getNetworksList();
    });

    this.props.accountsRetrieved();
  }

  getNetworksList() {
    this.networks = Object.keys(networks).map((network, index) => ({
      label: i18next.t(networks[network].name),
      value: index,
    }));
  }

  componentDidUpdate(prevProps) {
    if (this.props.account &&
      this.props.account.address &&
      !this.alreadyLoggedWithThisAddress(prevProps.account.address, prevProps.peers.options)) {
      this.redirectToReferrer();
    }
    if (!this.account) {
      this.autoLogin();
    }
  }

  redirectToReferrer() {
    const tem = this.getReferrerRoute();
    this.props.history.replace(tem);
    if (this.state.address) {
      localStorage.setItem('address', this.state.address);
    }
    localStorage.setItem('network', this.state.network);
  }

  alreadyLoggedWithThisAddress(address, network) {
    return this.props.account &&
      this.props.peers.options &&
      this.props.account.address === address &&
      this.props.peers.options.code === network.code &&
      this.props.peers.options.address === network.address;
  }

  getNetwork() {
    const network = Object.assign({}, getNetwork(this.state.network));
    if (this.state.network === networks.customNode.code) {
      network.address = this.state.address;
    }
    return network;
  }

  onLoginSubmission(passphrase) {
    const network = this.getNetwork();
    if (this.alreadyLoggedWithThisAddress(extractAddress(passphrase), network)) {
      this.redirectToReferrer();
      this.props.activeAccountSaved();
    } else {
      this.props.activePeerSet({
        passphrase,
        network,
      });
    }
  }

  getReferrerRoute() {
    const { isDelegate } = this.props.account;
    const search = parseSearchParams(this.props.history.location.search);
    const transactionRoute = '/main/transactions';
    const referrerRoute = search.referrer ? search.referrer : transactionRoute;
    if (!isDelegate && referrerRoute === '/main/forging') {
      return transactionRoute;
    }
    return referrerRoute;
  }

  // eslint-disable-next-line class-methods-use-this
  validatePassphrase(value, error) {
    const data = { passphrase: value };
    data.passphraseValidity = error || '';
    return data;
  }

  changeHandler(name, value, error) {
    const validator = this.validators[name] || (() => ({}));
    this.setState({
      [name]: value,
      ...validator(value, error),
    });
  }

  devPreFill() {
    const { networkIndex, address, passphrase } = getLoginData();

    this.setState({
      network: networkIndex,
      ...this.validators.address(address),
      ...this.validators.passphrase(passphrase),
    });

    // ignore this in coverage as it is hard to test and does not run in production
    /* istanbul ignore if */
    if (!env.production && localStorage.getItem('autologin') && !this.props.account.afterLogout && passphrase) {
      setTimeout(() => {
        this.onLoginSubmission(passphrase);
      });
    }
  }

  onFormSubmit(event) {
    event.preventDefault();
    this.onLoginSubmission(this.state.passphrase);
  }

  autoLogin() {
    const { savedAccounts } = this.props;
    if (savedAccounts && savedAccounts.lastActive && !this.props.account.afterLogout) {
      this.account = savedAccounts.lastActive;
      const network = Object.assign({}, getNetwork(this.account.network));
      if (this.account.network === networks.customNode.code) {
        network.address = this.account.address;
      }

      // set active peer
      this.props.activePeerSet({
        publicKey: this.account.publicKey,
        network,
      });
    } else {
      this.account = 'not-saved';
      this.devPreFill();
    }
  }

  passFocused() {
    this.setState({
      passInputState: 'focused',
    });
  }

  // eslint-disable-next-line class-methods-use-this
  showNetworkOptions() {
    const params = parseSearchParams(this.props.history.location.search);
    return params.showNetwork === 'true';
  }

  render() {
    return (
      <div className={`box ${styles.wrapper}`}>
        <section className={`${styles.login} ${styles[this.state.passInputState]}`}>
          <section className={styles.table}>
            <header>
              <a className={styles.backButton} href='https://list.io' target='_blank' rel='noopener noreferrer'>
                <FontIcon className={styles.icon}>arrow-left</FontIcon>
                <b>Back to lisk.io</b>
              </a>
            </header>
            <div className={`${styles.tableCell} text-left`}>
              <h2>{this.props.t('Sign In')}</h2>
              <form onSubmit={this.onFormSubmit.bind(this)}>
                <LanguageDropdown className={styles.outTaken} />
                {this.showNetworkOptions()
                  ? <div className={styles.outTaken}>
                    <Dropdown
                      auto={false}
                      source={this.networks}
                      onChange={this.changeHandler.bind(this, 'network')}
                      label={this.props.t('Select a network')}
                      value={this.state.network}
                      className='network'
                    />
                    {
                      this.state.network === networks.customNode.code &&
                      <Input type='text'
                        label={this.props.t('Node address')}
                        name='address'
                        className={`address ${styles.outTaken}`}
                        theme={styles}
                        value={this.state.address}
                        error={this.state.addressValidity}
                        onChange={this.changeHandler.bind(this, 'address')}/>
                    }
                  </div>
                  : ''
                }
                <PassphraseInput label={this.props.t('Enter your passphrase')}
                  className='passphrase'
                  onFocus={this.passFocused.bind(this)}
                  theme={styles}
                  error={this.state.passphraseValidity}
                  value={this.state.passphrase}
                  onChange={this.changeHandler.bind(this, 'passphrase')} />
                <footer className={ `${grid.row} ${grid['center-xs']}` }>
                  <div className={grid['col-xs-12']}>
                    <PrimaryButton label={this.props.t('Login')}
                      className='login-button'
                      type='submit'
                      disabled={(this.state.network === networks.customNode.code && this.state.addressValidity !== '') ||
                      this.state.passphraseValidity !== '' || this.state.passphrase === ''} />
                  </div>
                </footer>
              </form>
            </div>
          </section>
        </section>
        <section className={`${styles.signUp} ${styles[this.state.passInputState]}`}>
          <section className={styles.table}>
            <div className={`${styles.tableCell} text-left`}>
              <h2>
                <RelativeLink to='register' className='new-account-button'>
                  {this.props.t('Get Access')}
                </RelativeLink>
                <FontIcon className={styles.singUpArrow} value='arrow-right' />
              </h2>

              <h5>Create an address as a gateway to all Lisk Services.</h5>
            </div>
          </section>
          <div className={styles.bg}></div>
          <div className={styles.shapes}>
            <Parallax bgWidth='200px' bgHeight='10px'>
              <img src={shapes.circle} alt='circle' className={`${styles.circle} ${styles.shape}`} data-depth='0.5'/>
              <img src={shapes.triangle} alt='triangle' className={`${styles.triangle} ${styles.shape}`} data-depth='0.6'/>
              <img src={shapes.rect} alt='rect A' className={`${styles.rectA} ${styles.shape}`} data-depth='0.2'/>
              <img src={shapes.rect} alt='rect B' className={`${styles.rectB} ${styles.shape}`} data-depth='0.4'/>
              <img src={shapes.rect} alt='rect C' className={`${styles.rectC} ${styles.shape}`} data-depth='0.4'/>
            </Parallax>
          </div>
        </section>
      </div>
    );
  }
}

export default Login;
