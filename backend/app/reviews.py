from dataclasses import dataclass
import requests

ODRS_BASE_URL = 'https://odrs.gnome.org/1.0/reviews/api'

@dataclass
class AppReview: 
    average_rating: float

def get_reviews(ids: list[str]) -> list[AppReview]:
    # print(f'{ODRS_BASE_URL}/ratings')
    # return
    reviews = requests.get(f'{ODRS_BASE_URL}/ratings').json()
    
    keys_weight  = {
        "star0": 0,
        "star1": 1,
        "star2": 2,
        "star3": 3,
        "star4": 4,
        "star5": 5,
    }
    
    result = []
    ids_left = ids.copy()
    for r, review in reviews.items():
        if not ids_left:
            break
        
        if r not in ids:
            continue
        
        weight = 0
        for k, w in keys_weight.items():
            weight += review[k] * w
        
        average_rating = round(weight / review['total'], 1)
        app_review = AppReview(average_rating=average_rating)
        result.append(app_review)
        
    return result