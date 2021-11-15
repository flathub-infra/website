import { FunctionComponent } from 'react'
import styles from './List.module.scss'

interface Props {
  items: { icon: string | JSX.Element; header: string; content: string }[]
}

const List: FunctionComponent<Props> = ({ items }) => {
  return (
    <div className={styles.list}>
      <div>
        {items &&
          items.map((item, index) => (
            <div className={styles.item} key={index}>
              <div className={styles.icon}>{item.icon}</div>
              <div className={styles.details}>
                {item.header} <br />
                <span className={styles.content}>{item.content}</span>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

export default List
